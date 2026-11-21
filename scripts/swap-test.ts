// REAL mainnet swap + payout. Spends real USD₮.
// Usage: npm run swap:test -- <freelancerWallet> <currency> <amountUsdt>
//   e.g. npm run swap:test -- 0xabc... cNGN 5
import { verifyTx } from "@celo/attribution-tags";
import type { Address, Hex } from "viem";
import { PAYOUT_CURRENCIES, type PayoutCurrency } from "../src/config.js";
import { executePayout } from "../src/payout.js";
import { publicClient } from "../src/wallet.js";

const [to, currency, amount] = process.argv.slice(2);
if (!to || !currency || !amount || !PAYOUT_CURRENCIES.includes(currency as PayoutCurrency)) {
  console.error(`Usage: npm run swap:test -- <wallet> <${PAYOUT_CURRENCIES.join("|")}> <amountUsdt>`);
  process.exit(1);
}

const r = await executePayout({ id: "manual", freelancerWallet: to as Address, currency: currency as PayoutCurrency, amountUsdt: amount });
console.log(r);
for (const h of [r.approvalTx, r.swapTx, r.payoutTx].filter(Boolean) as Hex[]) {
  console.log(`https://celoscan.io/tx/${h}`, "tag:", JSON.stringify(await verifyTx({ client: publicClient as any, hash: h })));
}
