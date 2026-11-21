import type { Address, Hex } from "viem";
import { env, TOKENS, PAYOUT_CURRENCIES, type PayoutCurrency } from "./config.js";
import { balanceOf, toUnits, transferTagged } from "./erc20.js";
import { swap } from "./textile.js";

export type PayoutRequest = {
  id: string;
  freelancerWallet: Address;
  currency: PayoutCurrency;
  amountUsdt: string; // human units, e.g. "25"
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

/**
 * USD₮ -> freelancer's local stablecoin on Textile FX, then pay them.
 * Both the swap and the transfer carry the attribution tag.
 */
export async function executePayout(p: PayoutRequest): Promise<PayoutResult> {
  if (!PAYOUT_CURRENCIES.includes(p.currency)) throw new Error(`Unsupported currency ${p.currency}`);
  const amount = Number(p.amountUsdt);
  checkGuardrails(amount);

  const usdt = TOKENS.USDT;
  const target = TOKENS[p.currency];
  const sellAmount = await toUnits(usdt, p.amountUsdt);

  const before = await balanceOf(target);
  const { quote, swapTx, approvalTx } = await swap({ sellToken: usdt, buyToken: target, sellAmount });
  const after = await balanceOf(target);

  // Pay out what actually arrived (not the quoted figure) to avoid over-sending
  const received = after - before;
  if (received <= 0n) throw new Error(`Swap ${swapTx} delivered no ${p.currency}`);

  const payoutTx = await transferTagged(target, p.freelancerWallet, received);
  spentToday += amount;

  return { approvalTx, swapTx, payoutTx, rfqId: quote.rfqId, received };
}
