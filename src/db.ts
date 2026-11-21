import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import type { Address, Hex } from "viem";
import { env, type PayoutCurrency } from "./config.js";
import { createLease } from "./lock.js";
import { finishPayout } from "./payout.js";
import { inspectStuck } from "./recover.js";
import { agent } from "./wallet.js";

export const pb = new PocketBase(env.pbUrl);
const LOCK_TTL_MS = 10 * 60_000;

export type Resolution = "resolved" | "nothing_sent" | "unresolved";

const notFound = (e: unknown) => e instanceof ClientResponseError && e.status === 404;
const nameTaken = (e: unknown) => e instanceof ClientResponseError && e.status === 400 && Boolean(e.response?.data?.name);
const asLock = (r: RecordModel) => ({ id: r.id, name: String(r.name), owner: String(r.owner), heartbeat_at: String(r.heartbeat_at) });

export const lease = createLease(
  {
    find: (name) =>
      pb.collection("worker_locks").getFirstListItem(pb.filter("name = {:name}", { name })).then(asLock, (e) => {
        if (notFound(e)) return null;
        throw e;
      }),
    get: (id) =>
      pb.collection("worker_locks").getOne(id).then(asLock, (e) => {
        if (notFound(e)) return null;
        throw e;
      }),
    create: (rec) =>
      pb.collection("worker_locks").create(rec).then(asLock, (e) => {
        if (nameTaken(e)) return null;
        throw e;
      }),
    touch: async (id, heartbeatAt) => {
      await pb.collection("worker_locks").update(id, { heartbeat_at: heartbeatAt });
    },
    remove: async (id) => {
      await pb.collection("worker_locks").delete(id).catch((e) => {
        if (!notFound(e)) throw e;
      });
    },
  },
  "payout-worker",
  LOCK_TTL_MS,
);

export async function login() {
  await (pb as any).admins.authWithPassword(env.pbEmail, env.pbPassword);
}

async function recordedTxs(excludeId: string): Promise<Set<string>> {
  const recs = await pb.collection("payouts").getFullList({
    filter: pb.filter('id != {:id} && (swap_tx != "" || payout_tx != "")', { id: excludeId }),
    fields: "swap_tx,payout_tx",
  });
  const known = new Set<string>();
  for (const r of recs) for (const h of [r.swap_tx, r.payout_tx]) if (h) known.add(String(h).toLowerCase());
  return known;
}

export async function resolveOnChain(rec: RecordModel): Promise<Resolution> {
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
    knownTxs: await recordedTxs(rec.id),
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
