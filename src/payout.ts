import type { Address, Hex } from "viem";
import { env, TOKENS, PAYOUT_CURRENCIES, type PayoutCurrency } from "./config.js";
import { balanceOf, fromUnits, toUnits, transferTagged } from "./erc20.js";
import { preview, RetryLater, swap } from "./textile.js";

export type PayoutRequest = {
  id: string;
  freelancerWallet: Address;
  currency: PayoutCurrency;
  amountUsdt: string;
};

export type PayoutResult = {
  approvalTx?: Hex;
  swapTx: Hex;
  payoutTx: Hex;
  rfqId: string;
  received: bigint;
};

let spentToday = 0;
let dayKey = new Date().toISOString().slice(0, 10);

function checkGuardrails(amountUsdt: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; spentToday = 0; }
  if (amountUsdt > env.maxPayoutUsdt) throw new Error(`Payout ${amountUsdt} exceeds per-payout cap ${env.maxPayoutUsdt}`);
  if (spentToday + amountUsdt > env.maxDailyUsdt) throw new Error(`Daily cap ${env.maxDailyUsdt} would be exceeded`);
}

const SHALLOW_RETRY_MS = 10 * 60_000;

export async function ensureDepth(currency: PayoutCurrency, sellToken: Address, buyToken: Address, sellAmount: bigint) {
  const p = await preview({ sellToken, buyToken, sellAmount });
  if (p.status === "preview" && p.buyAmount && BigInt(p.buyAmount) > 0n) return;
  const need = await fromUnits(sellToken, sellAmount);
  const depth = p.availableSellAmount ? `${await fromUnits(sellToken, BigInt(p.availableSellAmount))} USDT` : "no";
  throw new RetryLater(
    `No liquidity: ${currency} corridor has ${depth} depth, payout needs ${need} USDT (${p.reason ?? p.status})`,
    p.retryAfterMs ?? SHALLOW_RETRY_MS,
  );
}

export async function executePayout(p: PayoutRequest): Promise<PayoutResult> {
  if (!PAYOUT_CURRENCIES.includes(p.currency)) throw new Error(`Unsupported currency ${p.currency}`);
  const amount = Number(p.amountUsdt);
  checkGuardrails(amount);

  const usdt = TOKENS.USDT;
  const target = TOKENS[p.currency];
  const sellAmount = await toUnits(usdt, p.amountUsdt);

  await ensureDepth(p.currency, usdt, target, sellAmount);

  const before = await balanceOf(target);
  const { quote, swapTx, approvalTx } = await swap({ sellToken: usdt, buyToken: target, sellAmount });
  const after = await balanceOf(target);

  const received = after - before;
  if (received <= 0n) throw new Error(`Swap ${swapTx} delivered no ${p.currency}`);

  const payoutTx = await transferTagged(target, p.freelancerWallet, received);
  spentToday += amount;

  return { approvalTx, swapTx, payoutTx, rfqId: quote.rfqId, received };
}
