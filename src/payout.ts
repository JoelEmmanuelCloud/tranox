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

export class DailyCapReached extends RetryLater {}

function msUntilNextUtcDay(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

function checkGuardrails(amountUsdt: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; spentToday = 0; }
  if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) throw new Error(`Payout amount must be a positive number, got ${amountUsdt}`);
  if (amountUsdt > env.maxPayoutUsdt) throw new Error(`Payout ${amountUsdt} exceeds per-payout cap ${env.maxPayoutUsdt}`);
  if (amountUsdt > env.maxDailyUsdt) throw new Error(`Payout ${amountUsdt} exceeds daily cap ${env.maxDailyUsdt} and can never be sent`);
  if (spentToday + amountUsdt > env.maxDailyUsdt) {
    const waitMs = msUntilNextUtcDay();
    throw new DailyCapReached(
      `Daily cap ${env.maxDailyUsdt} USDT reached (${spentToday} sent today, this payout needs ${amountUsdt}), waiting ${Math.ceil(waitMs / 60_000)} min until 00:00 UTC`,
      waitMs,
    );
  }
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
