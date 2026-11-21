import PocketBase, { type RecordModel } from "pocketbase";
import type { Address, Hex } from "viem";
import { env, type PayoutCurrency } from "./config.js";
import { DailyCapReached, executePayout, finishPayout, syncSpentToday, utcDayStart } from "./payout.js";
import { inspectStuck } from "./recover.js";
import { RetryLater, TextileError } from "./textile.js";
import { agent, publicClient } from "./wallet.js";

const pb = new PocketBase(env.pbUrl);
const POLL_MS = 15_000;
const DEFAULT_RETRY_MS = 60_000;

const nextAttempt = new Map<string, number>();
const firstSeen = new Map<string, number>();

type Resolution = "resolved" | "nothing_sent" | "unresolved";

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

async function recordedTxs(): Promise<Set<string>> {
  const recs = await pb.collection("payouts").getFullList({ filter: 'swap_tx != "" || payout_tx != ""', fields: "swap_tx,payout_tx" });
  const known = new Set<string>();
  for (const r of recs) for (const h of [r.swap_tx, r.payout_tx]) if (h) known.add(String(h).toLowerCase());
  return known;
}

async function resolveOnChain(rec: RecordModel): Promise<Resolution> {
  const started = Number(rec.started_block);
  if (!Number.isSafeInteger(started) || started <= 0) {
    await pb.collection("payouts").update(rec.id, { error: "Stuck in processing with no started_block; check the agent wallet by hand" });
    return "unresolved";
  }
  const currency = rec.currency as PayoutCurrency;
  const r = await inspectStuck({
    agentWallet: agent().address,
    freelancerWallet: rec.freelancer_wallet as Address,
    currency,
    startedBlock: BigInt(started),
    knownTxs: await recordedTxs(),
  });

  if (r.kind === "paid") {
    await pb.collection("payouts").update(rec.id, {
      status: "paid",
      paid_at: new Date().toISOString(),
      payout_tx: r.payoutTx,
      received_units: r.received.toString(),
      error: "Recovered: payout transfer found on-chain",
    });
    console.log(`recovered ${rec.id}: already paid in ${r.payoutTx}`);
    return "resolved";
  }

  if (r.kind === "pay") {
    let payoutTx: Hex;
    try {
      payoutTx = await finishPayout({ freelancerWallet: rec.freelancer_wallet as Address, currency }, r.received);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await pb.collection("payouts").update(rec.id, { swap_tx: r.swapTx, error: `Swap ${r.swapTx} landed but the transfer could not be finished: ${msg}` });
      return "unresolved";
    }
    await pb.collection("payouts").update(rec.id, {
      status: "paid",
      paid_at: new Date().toISOString(),
      swap_tx: r.swapTx,
      payout_tx: payoutTx,
      received_units: r.received.toString(),
      error: "Recovered: finished the transfer after the swap",
    });
    console.log(`recovered ${rec.id}: swap ${r.swapTx} finished with payout ${payoutTx}`);
    return "resolved";
  }

  if (r.kind === "wait") {
    await pb.collection("payouts").update(rec.id, { error: `Waiting to recover: ${r.reason}` });
    return "unresolved";
  }

  return "nothing_sent";
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

async function main() {
  await login();
  console.log("payout worker running");
  for (;;) {
    await tick().catch((e) => console.error("tick error", e));
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
