import { getAddress, parseAbiItem, type Address } from "viem";
import { publicClient } from "./wallet.js";

export const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const LOG_CHUNK = 10_000n;

type Cursor = { token: Address; owner: Address; sinceMs: number; nextBlock: bigint; total: bigint };
let cursor: Cursor | undefined;

export async function scanBlocks<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetch: (from: bigint, to: bigint) => Promise<T[]>,
  onChunk?: (items: T[], to: bigint) => void,
): Promise<T[]> {
  const all: T[] = [];
  let chunk = LOG_CHUNK;
  let next = fromBlock;
  while (next <= toBlock) {
    const to = next + chunk - 1n < toBlock ? next + chunk - 1n : toBlock;
    let items: T[];
    try {
      items = await fetch(next, to);
    } catch (e) {
      if (chunk > 1n && /max results|too many|range|size limit/i.test(e instanceof Error ? e.message : String(e))) {
        chunk /= 2n;
        continue;
      }
      throw e;
    }
    all.push(...items);
    onChunk?.(items, to);
    next = to + 1n;
  }
  return all;
}

export async function firstBlockAtOrAfter(timestampSec: bigint): Promise<bigint> {
  const latest = await publicClient.getBlock();
  if (latest.timestamp < timestampSec) return latest.number + 1n;
  const behind = (latest.timestamp - timestampSec) * 2n + 100n;
  let lo = latest.number > behind ? latest.number - behind : 0n;
  let hi = latest.number;
  if (lo > 0n && (await publicClient.getBlock({ blockNumber: lo })).timestamp >= timestampSec) lo = 0n;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const block = await publicClient.getBlock({ blockNumber: mid });
    if (block.timestamp < timestampSec) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

const inflows = new Map<string, { nextBlock: bigint; total: bigint }>();

export async function receivedSince(token: Address, from: Address, to: Address, sinceMs: number): Promise<bigint> {
  const t = getAddress(token);
  const f = getAddress(from);
  const r = getAddress(to);
  const key = `${t}:${f}:${r}:${sinceMs}`;
  let c = inflows.get(key);
  if (!c) {
    c = { nextBlock: await firstBlockAtOrAfter(BigInt(Math.floor(sinceMs / 1000))), total: 0n };
    inflows.set(key, c);
  }
  const state = c;
  const latest = await publicClient.getBlockNumber();
  await scanBlocks(
    state.nextBlock,
    latest,
    (fromBlock, toBlock) => publicClient.getLogs({ address: t, event: transferEvent, args: { from: f, to: r }, fromBlock, toBlock }),
    (logs, upTo) => {
      state.total += logs.reduce((sum, l) => sum + (l.args.value ?? 0n), 0n);
      state.nextBlock = upTo + 1n;
    },
  );
  return state.total;
}

export async function sentSince(token: Address, owner: Address, sinceMs: number): Promise<bigint> {
  const t = getAddress(token);
  const o = getAddress(owner);
  if (!cursor || cursor.token !== t || cursor.owner !== o || cursor.sinceMs !== sinceMs) {
    const nextBlock = await firstBlockAtOrAfter(BigInt(Math.floor(sinceMs / 1000)));
    cursor = { token: t, owner: o, sinceMs, nextBlock, total: 0n };
  }
  const c = cursor;
  const latest = await publicClient.getBlockNumber();
  await scanBlocks(
    c.nextBlock,
    latest,
    (fromBlock, toBlock) => publicClient.getLogs({ address: t, event: transferEvent, args: { from: o }, fromBlock, toBlock }),
    (logs, to) => {
      c.total += logs.reduce((sum, l) => sum + (l.args.value ?? 0n), 0n);
      c.nextBlock = to + 1n;
    },
  );
  return c.total;
}
