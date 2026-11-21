import { toDataSuffix } from "@celo/attribution-tags";
import { ClientResponseError, type RecordModel } from "pocketbase";
import { formatUnits, parseUnits } from "viem";
import { approvalMessage, verifyApproval, type ApprovalTarget } from "./approval.js";
import { env, PAYOUT_CURRENCIES, TOKENS, type PayoutCurrency } from "./config.js";
import { login, pb } from "./db.js";
import { decimals } from "./erc20.js";
import { preview } from "./textile.js";
import { agent, publicClient } from "./wallet.js";

const ID = /^[a-z0-9]{15}$/;
const RATE_TTL_MS = 2 * 60_000;

export class ViewError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const decimalsCache = new Map<string, number>();
const rateCache = new Map<string, { at: number; perUsdt: string | null }>();

async function ready() {
  if (!pb.authStore.isValid) await login();
}

async function getRecord(collection: string, id: string, what: string): Promise<RecordModel> {
  if (!ID.test(id)) throw new ViewError(400, `Invalid ${what} link`);
  await ready();
  return pb.collection(collection).getOne(id).catch((e) => {
    if (e instanceof ClientResponseError && e.status === 404) throw new ViewError(404, `${what[0].toUpperCase()}${what.slice(1)} not found`);
    throw e;
  });
}

async function tokenDecimals(currency: PayoutCurrency): Promise<number> {
  if (!decimalsCache.has(currency)) decimalsCache.set(currency, await decimals(TOKENS[currency]));
  return decimalsCache.get(currency)!;
}

async function ratePerUsdt(currency: PayoutCurrency): Promise<string | null> {
  const hit = rateCache.get(currency);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.perUsdt;
  let perUsdt: string | null = null;
  try {
    const p = await preview({ sellToken: TOKENS.USDT, buyToken: TOKENS[currency], sellAmount: parseUnits("1", await decimals(TOKENS.USDT)) });
    if (p.status === "preview" && p.buyAmount) perUsdt = formatUnits(BigInt(p.buyAmount), await tokenDecimals(currency));
  } catch {
    perUsdt = null;
  }
  rateCache.set(currency, { at: Date.now(), perUsdt });
  return perUsdt;
}

function cachedRate(currency: PayoutCurrency): string | null {
  const hit = rateCache.get(currency);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.perUsdt;
  ratePerUsdt(currency).catch(() => {});
  return null;
}

const TX_HASH = /^0x[0-9a-f]{64}$/;

export async function txView(hash: string) {
  if (!TX_HASH.test(hash)) throw new ViewError(400, "Invalid transaction hash");
  const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);
  return { hash, status: receipt ? receipt.status : "pending" };
}

export async function rateView(currency: string) {
  const c = asCurrency(currency);
  if (!c) throw new ViewError(404, "Unknown currency");
  return { currency: c, rate_per_usdt: await ratePerUsdt(c) };
}

function publicStatus(milestone: RecordModel, payout?: RecordModel): string {
  if (!payout) return milestone.status === "approved" ? "queued" : "pending";
  if (payout.status === "queued") return String(payout.error ?? "").startsWith("Waiting for client funds") ? "waiting_funds" : "queued";
  return String(payout.status);
}

async function payoutView(currency: PayoutCurrency, payout?: RecordModel) {
  if (!payout || payout.status !== "paid") return null;
  const units = String(payout.received_units ?? "");
  return {
    received: /^\d+$/.test(units) ? formatUnits(BigInt(units), await tokenDecimals(currency)) : null,
    swap_tx: payout.swap_tx || null,
    payout_tx: payout.payout_tx || null,
    paid_at: payout.paid_at || null,
  };
}

function asCurrency(v: unknown): PayoutCurrency | null {
  return PAYOUT_CURRENCIES.includes(v as PayoutCurrency) ? (v as PayoutCurrency) : null;
}

export async function jobView(id: string) {
  const job = await getRecord("jobs", id, "job");
  const freelancer = await pb.collection("freelancers").getOne(job.freelancer);
  const currency = asCurrency(freelancer.payout_currency);
  const milestones = await pb.collection("milestones").getFullList({ filter: pb.filter("job = {:j}", { j: job.id }), sort: "created" });
  const payouts = await pb.collection("payouts").getFullList({ filter: pb.filter("job = {:j} && milestone != ''", { j: job.id }) });
  const byMilestone = new Map(payouts.map((p) => [String(p.milestone), p]));
  return {
    job: { id: job.id, title: job.title, client: job.client },
    freelancer: { name: freelancer.name, country: freelancer.country || null, currency },
    client_wallet: job.client_wallet || null,
    agent_wallet: agent().address,
    usdt: TOKENS.USDT,
    usdt_decimals: await decimals(TOKENS.USDT),
    data_suffix: toDataSuffix(env.tag()),
    rate_per_usdt: currency ? cachedRate(currency) : null,
    milestones: await Promise.all(
      milestones.map(async (m) => ({
        id: m.id,
        title: m.title,
        amount_usdt: Number(m.amount_usdt),
        status: publicStatus(m, byMilestone.get(m.id)),
        payout: currency ? await payoutView(currency, byMilestone.get(m.id)) : null,
      })),
    ),
  };
}

export async function freelancerView(id: string) {
  const freelancer = await getRecord("freelancers", id, "freelancer");
  const currency = asCurrency(freelancer.payout_currency);
  const payouts = await pb.collection("payouts").getFullList({
    filter: pb.filter("freelancer = {:f}", { f: freelancer.id }),
    sort: "-created",
    expand: "job,milestone",
  });
  return {
    freelancer: { name: freelancer.name, country: freelancer.country || null, currency },
    rate_per_usdt: currency ? cachedRate(currency) : null,
    payouts: await Promise.all(
      payouts.map(async (p) => {
        const m = p.expand?.milestone as RecordModel | undefined;
        return {
          job: (p.expand?.job as RecordModel | undefined)?.title ?? null,
          milestone: m?.title ?? null,
          amount_usdt: Number(p.amount_usdt),
          currency: asCurrency(p.currency),
          status: m ? publicStatus(m, p) : String(p.status),
          created: p.created,
          payout: asCurrency(p.currency) ? await payoutView(asCurrency(p.currency)!, p) : null,
        };
      }),
    ),
  };
}

async function approvalTarget(milestoneId: string): Promise<{ target: ApprovalTarget; milestone: RecordModel }> {
  const milestone = await getRecord("milestones", milestoneId, "milestone");
  const job = await pb.collection("jobs").getOne(milestone.job);
  return {
    milestone,
    target: { milestoneId: milestone.id, jobId: job.id, amountUsdt: Number(milestone.amount_usdt), clientWallet: String(job.client_wallet ?? "") },
  };
}

export async function approvalChallenge(milestoneId: string) {
  const { target, milestone } = await approvalTarget(milestoneId);
  if (milestone.status !== "pending") throw new ViewError(409, "This milestone is already approved");
  const issuedAt = new Date().toISOString();
  return { issued_at: issuedAt, message: approvalMessage(target, issuedAt) };
}

export async function approveMilestone(milestoneId: string, issuedAt: unknown, signature: unknown) {
  const { target, milestone } = await approvalTarget(milestoneId);
  if (milestone.status !== "pending") throw new ViewError(409, "This milestone is already approved");
  const problem = await verifyApproval(target, issuedAt, signature);
  if (problem) throw new ViewError(403, problem);
  await pb.collection("milestones").update(milestone.id, { status: "approved" }).catch((e) => {
    if (e instanceof ClientResponseError && e.status === 400) throw new ViewError(400, e.response?.message || "The milestone could not be approved");
    throw e;
  });
  return { status: "approved" };
}
