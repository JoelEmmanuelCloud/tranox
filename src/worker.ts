/**
 * Polls GoWork's PocketBase `payouts` collection for queued payouts and executes them.
 *
 * Expected collection `payouts`:
 *   job (relation), freelancer (relation), freelancer_wallet (text), currency (select: cNGN|IDRX|wARS|wBRL|wMXN|wCOP),
 *   amount_usdt (number), status (select: queued|processing|paid|failed),
 *   rfq_id, approval_tx, swap_tx, payout_tx, received_units, error (text)
 *
 * A PocketBase hook on milestone approval should create a `queued` record.
 */
import PocketBase from "pocketbase";
import type { Address } from "viem";
import { env, type PayoutCurrency } from "./config.js";
import { executePayout } from "./payout.js";

const pb = new PocketBase(env.pbUrl);
const POLL_MS = 15_000;

async function login() {
  // pocketbase >=0.23 uses pb.collection("_superusers").authWithPassword
  await (pb as any).admins.authWithPassword(env.pbEmail, env.pbPassword);
}

async function tick() {
  const queued = await pb.collection("payouts").getFullList({ filter: 'status = "queued"', sort: "created" });
  for (const rec of queued) {
    await pb.collection("payouts").update(rec.id, { status: "processing" });
    try {
      const r = await executePayout({
        id: rec.id,
        freelancerWallet: rec.freelancer_wallet as Address,
        currency: rec.currency as PayoutCurrency,
        amountUsdt: String(rec.amount_usdt),
      });
      await pb.collection("payouts").update(rec.id, {
        status: "paid",
        rfq_id: r.rfqId,
        approval_tx: r.approvalTx ?? "",
        swap_tx: r.swapTx,
        payout_tx: r.payoutTx,
        received_units: r.received.toString(),
        error: "",
      });
      console.log(`paid ${rec.id}: swap ${r.swapTx} payout ${r.payoutTx}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // no_quote / expired quotes go back to the queue; everything else fails loudly
      const retry = /No quote|expired/i.test(msg);
      await pb.collection("payouts").update(rec.id, { status: retry ? "queued" : "failed", error: msg });
      console.error(`payout ${rec.id} ${retry ? "requeued" : "failed"}: ${msg}`);
    }
  }
}

async function main() {
  await login();
  console.log("payout worker running");
  for (;;) {
    await tick().catch((e) => console.error("tick error", e));
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
