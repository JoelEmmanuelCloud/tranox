import { getAddress, parseEventLogs, type Address, type Hex } from "viem";
import { TOKENS, type PayoutCurrency } from "./config.js";
import { scanBlocks, transferEvent } from "./spend.js";
import { publicClient } from "./wallet.js";

export type StuckPayout = {
  agentWallet: Address;
  freelancerWallet: Address;
  currency: PayoutCurrency;
  startedBlock: bigint;
  knownTxs: Set<string>;
};

export type Recovery =
  | { kind: "paid"; payoutTx: Hex; received: bigint }
  | { kind: "pay"; swapTx: Hex; received: bigint }
  | { kind: "requeue" }
  | { kind: "wait"; reason: string };

export async function hasPendingTx(address: Address): Promise<boolean> {
  const [latest, pending] = await Promise.all([
    publicClient.getTransactionCount({ address, blockTag: "latest" }),
    publicClient.getTransactionCount({ address, blockTag: "pending" }),
  ]);
  return pending > latest;
}

export async function receivedInSwap(tx: Hex, target: Address, self: Address): Promise<bigint> {
  const receipt = await publicClient.getTransactionReceipt({ hash: tx });
  if (receipt.status !== "success") return 0n;
  const logs = parseEventLogs({ abi: [transferEvent], logs: receipt.logs });
  const paidUsdt = logs.some((l) => getAddress(l.address) === TOKENS.USDT && getAddress(l.args.from) === self);
  if (!paidUsdt) return 0n;
  return logs
    .filter((l) => getAddress(l.address) === target && getAddress(l.args.to) === self)
    .reduce((sum, l) => sum + l.args.value, 0n);
}

export async function inspectStuck(p: StuckPayout): Promise<Recovery> {
  const self = getAddress(p.agentWallet);
  if (await hasPendingTx(self)) return { kind: "wait", reason: "agent wallet has a transaction still pending" };

  const target = TOKENS[p.currency];
  const freelancer = getAddress(p.freelancerWallet);
  const latest = await publicClient.getBlockNumber();
  const isNew = (tx: Hex | null) => tx !== null && !p.knownTxs.has(tx.toLowerCase());

  const payouts = (
    await scanBlocks(p.startedBlock, latest, (fromBlock, toBlock) =>
      publicClient.getLogs({ address: target, event: transferEvent, args: { from: self, to: freelancer }, fromBlock, toBlock }),
    )
  ).filter((l) => isNew(l.transactionHash));
  if (payouts.length > 1) return { kind: "wait", reason: `found ${payouts.length} unrecorded transfers to ${freelancer}; check by hand` };
  if (payouts.length === 1) {
    const l = payouts[0];
    return { kind: "paid", payoutTx: l.transactionHash!, received: l.args.value ?? 0n };
  }

  const inbound = (
    await scanBlocks(p.startedBlock, latest, (fromBlock, toBlock) =>
      publicClient.getLogs({ address: target, event: transferEvent, args: { to: self }, fromBlock, toBlock }),
    )
  ).filter((l) => isNew(l.transactionHash));
  const swapTxs = [...new Set(inbound.map((l) => l.transactionHash!))];
  const swaps: { tx: Hex; received: bigint }[] = [];
  for (const tx of swapTxs) {
    const received = await receivedInSwap(tx, target, self);
    if (received > 0n) swaps.push({ tx, received });
  }
  if (swaps.length > 1) return { kind: "wait", reason: `found ${swaps.length} unrecorded swaps into ${p.currency}; check by hand` };
  if (swaps.length === 1) return { kind: "pay", swapTx: swaps[0].tx, received: swaps[0].received };

  return { kind: "requeue" };
}
