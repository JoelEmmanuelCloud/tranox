import PocketBase from "pocketbase";
import type { Address } from "viem";
import { env, type PayoutCurrency } from "./config.js";
import { DailyCapReached, executePayout } from "./payout.js";
import { RetryLater, TextileError } from "./textile.js";

const pb = new PocketBase(env.pbUrl);
const POLL_MS = 15_000;
const DEFAULT_RETRY_MS = 60_000;

const nextAttempt = new Map<string, number>();
const firstSeen = new Map<string, number>();

async function login() {
  await (pb as any).admins.authWithPassword(env.pbEmail, env.pbPassword);
}

function retryDelay(e: unknown): number | undefined {
  if (e instanceof RetryLater) return e.retryAfterMs ?? DEFAULT_RETRY_MS;
  if (e instanceof TextileError && e.httpStatus === 429) return DEFAULT_RETRY_MS;
  return undefined;
}

function queuedSince(rec: { id: string; created?: string }): number {
  const created = rec.created ? Date.parse(rec.created) : NaN;
  if (!Number.isNaN(created)) return created;
  if (!firstSeen.has(rec.id)) firstSeen.set(rec.id, Date.now());
  return firstSeen.get(rec.id)!;
}

async function tick() {
  const queued = await pb.collection("payouts").getFullList({ filter: 'status = "queued"', sort: "created" });
  const now = Date.now();
  for (const rec of queued) {
    if ((nextAttempt.get(rec.id) ?? 0) > now) continue;
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
      nextAttempt.delete(rec.id);
      firstSeen.delete(rec.id);
      console.log(`paid ${rec.id}: swap ${r.swapTx} payout ${r.payoutTx}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const delay = retryDelay(e);
      const waitedHours = (Date.now() - queuedSince(rec)) / 3_600_000;
      if (delay !== undefined && (e instanceof DailyCapReached || waitedHours < env.maxQueueHours)) {
        nextAttempt.set(rec.id, Date.now() + delay);
        await pb.collection("payouts").update(rec.id, { status: "queued", error: msg });
        console.error(`payout ${rec.id} requeued, next try in ${Math.round(delay / 1000)}s: ${msg}`);
      } else {
        nextAttempt.delete(rec.id);
        firstSeen.delete(rec.id);
        const reason = delay !== undefined ? `Gave up after ${env.maxQueueHours}h waiting: ${msg}` : msg;
        await pb.collection("payouts").update(rec.id, { status: "failed", error: reason });
        console.error(`payout ${rec.id} failed: ${reason}`);
      }
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
