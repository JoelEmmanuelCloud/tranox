import { erc20Abi, getAddress, toHex, type Address, type Hex } from "viem";
import { CHAIN_ID, env } from "./config.js";
import { agent, publicClient, sendTagged } from "./wallet.js";

type PreparedTx = { to: Address; data: Hex; value: string; chainId: number };

type Liquidity = {
  reason?: "no_makers_online" | "no_restricted_liquidity" | "no_valid_quote" | string;
  availableSellAmount?: string;
  availableBuyAmount?: string;
  reservedUntil?: string;
  retryAfterMs?: number;
};

export type Preview = Liquidity & {
  status: "preview" | "no_quote";
  sellAmount?: string;
  buyAmount?: string;
  feeAmount?: string;
  takerPays?: string;
  rateRay?: string;
};

export type FirmQuote = Liquidity & {
  rfqId: string;
  claimToken: string;
  status: "quoted" | "no_quote";
  route?: string;
  quote?: {
    sellAmount: string;
    buyAmount: string;
    feeAmount: string;
    takerPays: string;
    rateRay: string;
    expiresAt: string;
    orderDeadline: string;
    reactor: Address;
    spender?: Address;
    taker: Address;
  };
  transactions?: { approval: PreparedTx; swap?: PreparedTx };
};

type SwapParams = {
  sellToken: Address;
  buyToken: Address;
  sellAmount?: bigint;
  buyAmount?: bigint;
};

export class TextileError extends Error {
  constructor(
    readonly path: string,
    readonly httpStatus: number,
    readonly code: string,
    readonly reason: string | undefined,
    readonly requestId: string | undefined,
    message: string,
  ) {
    super(`Textile ${path} ${httpStatus} ${code}${reason ? `/${reason}` : ""}: ${message}${requestId ? ` (request ${requestId})` : ""}`);
  }
}

export class RetryLater extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
  }
}

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
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new TextileError(path, res.status, "invalid_response", undefined, res.headers.get("x-request-id") ?? undefined, text.slice(0, 300));
  }
  if (!res.ok) {
    const e = json.error ?? {};
    throw new TextileError(path, res.status, e.code ?? "unknown", e.details?.reason, e.request_id ?? res.headers.get("x-request-id") ?? undefined, e.message ?? text.slice(0, 300));
  }
  if (!json.data) throw new TextileError(path, res.status, "invalid_response", undefined, undefined, "response has no data field");
  return json.data as T;
}

function amountFields(p: SwapParams) {
  if ((p.sellAmount === undefined) === (p.buyAmount === undefined)) {
    throw new Error("Pass exactly one of sellAmount or buyAmount");
  }
  return p.sellAmount !== undefined ? { sellAmount: p.sellAmount.toString() } : { buyAmount: p.buyAmount!.toString() };
}

async function takerProof() {
  const account = agent();
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const issuedAt = Date.now();
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

function noQuote(q: Liquidity & { status: string }) {
  const parts = [`No quote: ${q.status}`, q.reason];
  if (q.availableSellAmount) parts.push(`available ${q.availableSellAmount}`);
  if (q.retryAfterMs) parts.push(`retry in ${q.retryAfterMs}ms`);
  return new RetryLater(parts.filter(Boolean).join(" "), q.retryAfterMs);
}

export async function preview(p: SwapParams): Promise<Preview> {
  return post<Preview>("/rfq/preview", {
    chainId: CHAIN_ID,
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    ...amountFields(p),
  });
}

export async function requestQuote(p: SwapParams): Promise<FirmQuote> {
  return post<FirmQuote>("/rfq/request", {
    chainId: CHAIN_ID,
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    ...amountFields(p),
    taker: agent().address,
    ...(env.textileKey ? {} : { takerProof: await takerProof() }),
  });
}

export async function submitHash(q: FirmQuote, txHash: Hex) {
  return post(`/rfq/${q.rfqId}/submit`, { txHash }, { "X-Rfq-Claim": q.claimToken }, 30_000);
}

export async function cancel(q: FirmQuote) {
  return post(`/rfq/${q.rfqId}/cancel`, {}, { "X-Rfq-Claim": q.claimToken }, 30_000);
}

export async function swap(p: SwapParams): Promise<{ quote: FirmQuote; swapTx: Hex; approvalTx?: Hex }> {
  const q = await requestQuote(p);
  if (q.status !== "quoted" || !q.quote || !q.transactions) throw noQuote(q);
  if (!q.transactions.swap) {
    await cancel(q).catch(() => {});
    throw new RetryLater(`No quote: route ${q.route ?? "unknown"} has no swap transaction and is not supported`);
  }
  if (getAddress(q.quote.taker) !== agent().address) {
    throw new Error(`Quote ${q.rfqId} is bound to ${q.quote.taker}, not the agent wallet`);
  }

  const expiresAtMs = Date.parse(q.quote.expiresAt);
  if (Number.isNaN(expiresAtMs)) throw new Error(`Quote ${q.rfqId} has unreadable expiresAt ${q.quote.expiresAt}`);

  let approvalTx: Hex | undefined;
  const allowance = await publicClient.readContract({
    address: p.sellToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [agent().address, q.quote.spender ?? q.quote.reactor],
  });
  if (allowance < BigInt(q.quote.takerPays)) {
    const a = q.transactions.approval;
    approvalTx = await sendTagged({ to: a.to, data: a.data, value: BigInt(a.value || "0") });
  }

  if (Date.now() >= expiresAtMs) {
    await cancel(q).catch(() => {});
    throw new RetryLater(`Quote ${q.rfqId} expired before swap, re-request`);
  }

  const s = q.transactions.swap;
  const swapTx = await sendTagged({ to: s.to, data: s.data, value: BigInt(s.value || "0") });

  await submitHash(q, swapTx).catch((e) =>
    console.error(`swap ${swapTx} landed but reporting it to Textile failed:`, e instanceof Error ? e.message : e),
  );
  return { quote: q, swapTx, approvalTx };
}
