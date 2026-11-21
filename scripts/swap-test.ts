import { verifyTx } from "@celo/attribution-tags";
import type { Address, Hex } from "viem";
import { PAYOUT_CURRENCIES, type PayoutCurrency } from "../src/config.js";
import { lease, login, pb, resolveOnChain } from "../src/db.js";
import { checkRecipient, executePayout, type PayoutResult } from "../src/payout.js";
import { publicClient } from "../src/wallet.js";

const args = process.argv.slice(2);
const standalone = args.includes("--standalone");
const [to, currency, amount] = args.filter((a) => a !== "--standalone");

if (!to || !currency || !amount || !PAYOUT_CURRENCIES.includes(currency as PayoutCurrency)) {
  console.error(`Usage: npm run swap:test -- <wallet> <${PAYOUT_CURRENCIES.join("|")}> <amountUsdt> [--standalone]`);
  process.exit(1);
}
if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
  console.error(`Amount must be a positive number, got "${amount}"`);
  process.exit(1);
}

async function printLinks(r: Pick<PayoutResult, "approvalTx" | "swapTx" | "payoutTx">) {
  for (const h of [r.approvalTx, r.swapTx, r.payoutTx].filter(Boolean) as Hex[]) {
    console.log(`https://celoscan.io/tx/${h}`, "tag:", JSON.stringify(await verifyTx({ client: publicClient as any, hash: h })));
  }
}

async function runStandalone(wallet: Address) {
  console.warn("Running without PocketBase: this payout is not recorded and is not locked against the worker.");
  console.warn("Use this only before PocketBase is set up and while no worker is running.");
  const r = await executePayout({ id: "manual", freelancerWallet: wallet, currency: currency as PayoutCurrency, amountUsdt: amount });
  console.log(r);
  await printLinks(r);
}

async function runRecorded(wallet: Address) {
  await login();
  if (!(await lease.hold())) {
    throw new Error("The payout worker or another swap:test holds the payout lock. Stop it first, or wait up to 10 minutes if it crashed.");
  }
  try {
    const stuck = await pb.collection("payouts").getFullList({ filter: 'status = "processing"', fields: "id" });
    if (stuck.length > 0) {
      throw new Error(`Payouts stuck in processing: ${stuck.map((r) => r.id).join(", ")}. Run the worker to settle them first.`);
    }
    const startedBlock = await publicClient.getBlockNumber();
    const rec = await pb.collection("payouts").create({
      source: "manual",
      freelancer_wallet: wallet,
      currency,
      amount_usdt: Number(amount),
      status: "processing",
      started_block: Number(startedBlock),
    });
    console.log(`Recorded as payout ${rec.id}`);
    try {
      const r = await executePayout({ id: rec.id, freelancerWallet: wallet, currency: currency as PayoutCurrency, amountUsdt: amount });
      await pb.collection("payouts").update(rec.id, {
        status: "paid",
        paid_at: new Date().toISOString(),
        rfq_id: r.rfqId,
        approval_tx: r.approvalTx ?? "",
        swap_tx: r.swapTx,
        payout_tx: r.payoutTx,
        received_units: r.received.toString(),
        error: "",
      });
      console.log(r);
      await printLinks(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const outcome = await resolveOnChain(rec).catch((err) => {
        console.error("Chain check failed:", err instanceof Error ? err.message : err);
        return "unresolved" as const;
      });
      if (outcome === "nothing_sent") {
        await pb.collection("payouts").update(rec.id, { status: "failed", error: msg });
        throw new Error(`Payout ${rec.id} failed before anything was sent: ${msg}`);
      }
      if (outcome === "unresolved") {
        throw new Error(`Payout ${rec.id} is left in processing; the worker will settle it from the chain. Cause: ${msg}`);
      }
      console.log(`Payout ${rec.id} hit an error but was settled from the chain: ${msg}`);
    }
  } finally {
    await lease.release().catch((e) => console.error("Could not release the payout lock:", e));
  }
}

try {
  const wallet = checkRecipient(to);
  if (standalone) await runStandalone(wallet);
  else await runRecorded(wallet);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
