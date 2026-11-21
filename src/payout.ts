import { formatUnits, getAddress, isAddress, type Address, type Hex } from "viem";
import { env, TOKENS, PAYOUT_CURRENCIES, type PayoutCurrency } from "./config.js";
import { balanceOf, decimals, fromUnits, toUnits, transferTagged } from "./erc20.js";
import { sentSince } from "./spend.js";
import { agent } from "./wallet.js";
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
  return utcDayStart(now).getTime() + 86_400_000 - now.getTime();
}

export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function syncSpentToday(amountUsdt: number) {
  if (!Number.isFinite(amountUsdt) || amountUsdt < 0) throw new Error(`Spent today must be a non-negative number, got ${amountUsdt}`);
  dayKey = new Date().toISOString().slice(0, 10);
  spentToday = amountUsdt;
}

async function checkGuardrails(amountUsdt: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; spentToday = 0; }
  if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) throw new Error(`Payout amount must be a positive number, got ${amountUsdt}`);
  if (amountUsdt > env.maxPayoutUsdt) throw new Error(`Payout ${amountUsdt} exceeds per-payout cap ${env.maxPayoutUsdt}`);
  if (amountUsdt > env.maxDailyUsdt) throw new Error(`Payout ${amountUsdt} exceeds daily cap ${env.maxDailyUsdt} and can never be sent`);
  const onChain = Number(formatUnits(await sentSince(TOKENS.USDT, agent().address, utcDayStart().getTime()), await decimals(TOKENS.USDT)));
  const spent = Math.max(spentToday, onChain);
  if (spent + amountUsdt > env.maxDailyUsdt) {
    const waitMs = msUntilNextUtcDay();
    throw new DailyCapReached(
      `Daily cap ${env.maxDailyUsdt} USDT reached (${spent} sent today, this payout needs ${amountUsdt}), waiting ${Math.ceil(waitMs / 60_000)} min until 00:00 UTC`,
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

export function checkRecipient(wallet: string): Address {
  if (!isAddress(wallet, { strict: false })) throw new Error(`Freelancer wallet is not a valid address: ${wallet}`);
  const to = getAddress(wallet);
  if (to === agent().address) throw new Error("Freelancer wallet is the agent wallet; refusing to pay itself");
  const allowlist = env.freelancerAllowlist();
  if (allowlist.length === 0) throw new Error("FREELANCER_ALLOWLIST is empty; no payouts are allowed until it is set");
  if (!allowlist.includes(to)) throw new Error(`Freelancer wallet ${to} is not on FREELANCER_ALLOWLIST`);
  return to;
}

export async function executePayout(p: PayoutRequest): Promise<PayoutResult> {
  if (!PAYOUT_CURRENCIES.includes(p.currency)) throw new Error(`Unsupported currency ${p.currency}`);
  const to = checkRecipient(p.freelancerWallet);
  const amount = Number(p.amountUsdt);
  await checkGuardrails(amount);

  const usdt = TOKENS.USDT;
  const target = TOKENS[p.currency];
  const sellAmount = await toUnits(usdt, p.amountUsdt);

  await ensureDepth(p.currency, usdt, target, sellAmount);

  const before = await balanceOf(target);
  const { quote, swapTx, approvalTx } = await swap({ sellToken: usdt, buyToken: target, sellAmount });
  const after = await balanceOf(target);

  const received = after - before;
  if (received <= 0n) throw new Error(`Swap ${swapTx} delivered no ${p.currency}`);

  const payoutTx = await transferTagged(target, to, received);
  spentToday += amount;

  return { approvalTx, swapTx, payoutTx, rfqId: quote.rfqId, received };
}
