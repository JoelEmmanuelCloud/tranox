import { getAddress, parseAbiItem, type Address } from "viem";
import { publicClient } from "./wallet.js";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const LOG_CHUNK = 10_000n;

type Cursor = { token: Address; owner: Address; sinceMs: number; nextBlock: bigint; total: bigint };
let cursor: Cursor | undefined;

async function firstBlockAtOrAfter(timestampSec: bigint): Promise<bigint> {
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

export async function sentSince(token: Address, owner: Address, sinceMs: number): Promise<bigint> {
  const t = getAddress(token);
  const o = getAddress(owner);
  if (!cursor || cursor.token !== t || cursor.owner !== o || cursor.sinceMs !== sinceMs) {
    const nextBlock = await firstBlockAtOrAfter(BigInt(Math.floor(sinceMs / 1000)));
    cursor = { token: t, owner: o, sinceMs, nextBlock, total: 0n };
  }
  const latest = await publicClient.getBlockNumber();
  let chunk = LOG_CHUNK;
  while (cursor.nextBlock <= latest) {
    const toBlock = cursor.nextBlock + chunk - 1n < latest ? cursor.nextBlock + chunk - 1n : latest;
    let logs;
    try {
      logs = await publicClient.getLogs({ address: t, event: transferEvent, args: { from: o }, fromBlock: cursor.nextBlock, toBlock });
    } catch (e) {
      if (chunk > 1n && /max results|too many|range/i.test(e instanceof Error ? e.message : String(e))) {
        chunk /= 2n;
        continue;
      }
      throw e;
    }
    cursor.total += logs.reduce((sum, l) => sum + (l.args.value ?? 0n), 0n);
    cursor.nextBlock = toBlock + 1n;
  }
  return cursor.total;
}
