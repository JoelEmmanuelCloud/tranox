/**
 * Textile FX RFQ v2 client (keyless taker flow).
 * Docs: https://fx-docs.textilecredit.com/api/v2/rfq.html
 *       https://fx-docs.textilecredit.com/api/v2/authentication.html
 *
 * Flow: preview -> request (firm quote) -> approve if needed -> swap -> submit hash.
 */
import { erc20Abi, toHex, type Address, type Hex } from "viem";
import { CHAIN_ID, env } from "./config.js";
import { account, publicClient, sendTagged } from "./wallet.js";

type PreparedTx = { to: Address; data: Hex; value: string; chainId: number };

export type FirmQuote = {
  rfqId: string;
  claimToken: string;
  status: "quoted" | "no_quote" | string;
  reason?: string;
  quote?: {
    sellAmount: string;
    buyAmount: string;
    feeAmount: string;
    takerPays: string;
    rateRay: string;
    expiresAt: number | string;
    reactor: Address;
  };
  transactions?: { approval?: PreparedTx; swap: PreparedTx };
};

type SwapParams = {
  sellToken: Address;
  buyToken: Address;
  /** Exactly one of sellAmount / buyAmount, in base units. */
  sellAmount?: bigint;
  buyAmount?: bigint;
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", ...extra };
  if (env.textileKey) h.authorization = `Bearer ${env.textileKey}`;
  return h;
}

async function post<T>(path: string, body: unknown, extraHeaders?: Record<string, string>, timeoutMs = 75_000): Promise<T> {
  const res = await fetch(`${env.textileUrl}${path}`, {
    method: "POST",
    headers: headers(extraHeaders),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs), // docs: allow 75 s for /request
  });
  if (!res.ok) throw new Error(`Textile ${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function amountFields(p: SwapParams) {
  if ((p.sellAmount === undefined) === (p.buyAmount === undefined)) {
    throw new Error("Pass exactly one of sellAmount or buyAmount");
  }
  return p.sellAmount !== undefined ? { sellAmount: p.sellAmount.toString() } : { buyAmount: p.buyAmount!.toString() };
}

/** EIP-712 TakerControl v1 proof — needed for keyless callers. */
async function takerProof() {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const issuedAt = Date.now(); // milliseconds
  const signature = await account.signTypedData({
    domain: { name: "Textile Taker Control", version: "1", chainId: CHAIN_ID },
    types: {
      TakerControl: [
        { name: "taker", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
      ],
    },
    primaryType: "TakerControl",
    message: { taker: account.address, chainId: BigInt(CHAIN_ID), nonce, issuedAt: BigInt(issuedAt) },
  });
  return { nonce, issuedAt, signature };
}

/** Indicative price only — nothing reserved. Use to check corridor liquidity. */
export async function preview(p: SwapParams) {
  return post<unknown>("/rfq/preview", {
    chainId: CHAIN_ID,
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    ...amountFields(p),
  });
}

/** Firm quote bound to the agent wallet. */
export async function requestQuote(p: SwapParams): Promise<FirmQuote> {
  return post<FirmQuote>("/rfq/request", {
    chainId: CHAIN_ID,
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    ...amountFields(p),
    taker: account.address,
    ...(env.textileKey ? {} : { takerProof: await takerProof() }),
  });
}

export async function submitHash(q: FirmQuote, txHash: Hex) {
  return post(`/rfq/${q.rfqId}/submit`, { txHash }, { "X-Rfq-Claim": q.claimToken }, 30_000);
}

export async function cancel(q: FirmQuote) {
  return post(`/rfq/${q.rfqId}/cancel`, {}, { "X-Rfq-Claim": q.claimToken }, 30_000);
}

/**
 * Get a firm quote and execute it. Every tx is tagged.
 * Returns the swap tx hash and the amount of buyToken received (per quote).
 */
export async function swap(p: SwapParams): Promise<{ quote: FirmQuote; swapTx: Hex; approvalTx?: Hex }> {
  const q = await requestQuote(p);
  if (q.status !== "quoted" || !q.quote || !q.transactions) {
    throw new Error(`No quote: ${q.status} ${q.reason ?? ""}`);
  }

  // 1. Approve the reactor if allowance is short (plain ERC-20 approve, tagged)
  let approvalTx: Hex | undefined;
  const allowance = await publicClient.readContract({
    address: p.sellToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, q.quote.reactor],
  });
  if (allowance < BigInt(q.quote.takerPays) && q.transactions.approval) {
    const a = q.transactions.approval;
    approvalTx = await sendTagged({ to: a.to, data: a.data, value: BigInt(a.value || "0") }); // waits for receipt
  }

  // 2. Quote must still be valid
  const expiresAtMs = Number(q.quote.expiresAt) < 1e12 ? Number(q.quote.expiresAt) * 1000 : Number(q.quote.expiresAt);
  if (Date.now() >= expiresAtMs) {
    await cancel(q).catch(() => {});
    throw new Error("Quote expired before swap — re-request");
  }

  // 3. Send the prepared batch swap (tagged)
  const s = q.transactions.swap;
  const swapTx = await sendTagged({ to: s.to, data: s.data, value: BigInt(s.value || "0") });

  // 4. Report the hash to Textile
  await submitHash(q, swapTx);
  return { quote: q, swapTx, approvalTx };
}
