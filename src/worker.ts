import type { Address } from "viem";
import { env, type PayoutCurrency } from "./config.js";
import { lease, login, pb, resolveOnChain } from "./db.js";
import { DailyCapReached, executePayout, syncSpentToday, utcDayStart } from "./payout.js";
import { RetryLater, TextileError } from "./textile.js";
import { publicClient } from "./wallet.js";

const POLL_MS = 15_000;
const DEFAULT_RETRY_MS = 60_000;

const nextAttempt = new Map<string, number>();
const firstSeen = new Map<string, number>();

let stopping = false;
let wake: (() => void) | undefined;

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

function forget(id: string) {
  nextAttempt.delete(id);
  firstSeen.delete(id);
}

async function loadSpentToday() {
  const counted = await pb.collection("payouts").getFullList({
    filter: pb.filter('(status = "paid" && paid_at >= {:start}) || status = "processing"', { start: utcDayStart() }),
    fields: "amount_usdt",
  });
  const total = counted.reduce((sum, r) => sum + Number(r.amount_usdt), 0);
  if (!Number.isFinite(total)) throw new Error("A paid or processing payout has an unreadable amount_usdt");
  syncSpentToday(total);
}

async function recoverProcessing(): Promise<boolean> {
  const stuck = await pb.collection("payouts").getFullList({ filter: 'status = "processing"', sort: "created" });
  let clear = true;
  for (const rec of stuck) {
    const outcome = await resolveOnChain(rec);
    if (outcome === "nothing_sent") {
      await pb.collection("payouts").update(rec.id, { status: "queued", error: "Recovered: nothing was sent before the interruption" });
      console.log(`recovered ${rec.id}: nothing sent, requeued`);
    } else if (outcome === "unresolved") {
      clear = false;
      console.error(`payout ${rec.id} is still processing and needs attention`);
    }
  }
  return clear;
}

async function tick() {
  if (!(await recoverProcessing())) {
    console.error("new payouts are on hold until processing payouts are resolved");
    return;
  }
  await loadSpentToday();
  const queued = await pb.collection("payouts").getFullList({ filter: 'status = "queued"', sort: "created" });
  const now = Date.now();
  for (const rec of queued) {
    if ((nextAttempt.get(rec.id) ?? 0) > now) continue;
    if (stopping || !(await lease.hold())) return;
    const startedBlock = await publicClient.getBlockNumber();
    await pb.collection("payouts").update(rec.id, { status: "processing", started_block: Number(startedBlock) });
    try {
      const r = await executePayout({
        id: rec.id,
        freelancerWallet: rec.freelancer_wallet as Address,
        currency: rec.currency as PayoutCurrency,
        amountUsdt: String(rec.amount_usdt),
      });
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
      forget(rec.id);
      console.log(`paid ${rec.id}: swap ${r.swapTx} payout ${r.payoutTx}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const delay = retryDelay(e);
      const waitedHours = (Date.now() - queuedSince(rec)) / 3_600_000;
      if (delay !== undefined && (e instanceof DailyCapReached || waitedHours < env.maxQueueHours)) {
        nextAttempt.set(rec.id, Date.now() + delay);
        await pb.collection("payouts").update(rec.id, { status: "queued", error: msg });
        console.error(`payout ${rec.id} requeued, next try in ${Math.round(delay / 1000)}s: ${msg}`);
        continue;
      }
      const outcome = await resolveOnChain({ ...rec, started_block: Number(startedBlock) }).catch((err) => {
        console.error(`payout ${rec.id} chain check failed`, err);
        return "unresolved" as const;
      });
      if (outcome === "unresolved") {
        await pb.collection("payouts").update(rec.id, { error: `${msg} (left in processing until the chain check can settle it)` });
        console.error(`payout ${rec.id} left in processing: ${msg}`);
        return;
      }
      if (outcome === "nothing_sent") {
        forget(rec.id);
        const reason = delay !== undefined ? `Gave up after ${env.maxQueueHours}h waiting: ${msg}` : msg;
        await pb.collection("payouts").update(rec.id, { status: "failed", error: reason });
        console.error(`payout ${rec.id} failed: ${reason}`);
      } else {
        forget(rec.id);
      }
    }
  }
}

function stop() {
  if (stopping) process.exit(1);
  stopping = true;
  console.log("stopping after the current check; press Ctrl+C again to force");
  wake?.();
}

async function main() {
  await login();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log(`payout worker ${lease.owner} running`);
  while (!stopping) {
    const held = await lease.hold().catch((e) => {
      console.error("lock check failed", e);
      return false;
    });
    if (held) await tick().catch((e) => console.error("tick error", e));
    else console.error("another worker holds the payout lock; waiting");
    if (!stopping) await new Promise<void>((r) => { wake = r; setTimeout(r, POLL_MS); });
  }
  await lease.release().catch((e) => console.error("could not release the payout lock", e));
  console.log("payout worker stopped");
}

main();
