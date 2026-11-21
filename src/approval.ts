import { getAddress, isAddress, isHex, type Address } from "viem";
import { publicClient } from "./wallet.js";

const MAX_AGE_MS = 10 * 60_000;
const MAX_SKEW_MS = 2 * 60_000;

export type ApprovalTarget = { milestoneId: string; jobId: string; amountUsdt: number; clientWallet: string };

export function approvalMessage(t: ApprovalTarget, issuedAt: string): string {
  return [
    "Tranox: approve this milestone and release the payout.",
    `Milestone: ${t.milestoneId}`,
    `Job: ${t.jobId}`,
    `Amount: ${t.amountUsdt} USDT`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

export async function verifyApproval(t: ApprovalTarget, issuedAt: unknown, signature: unknown, now = Date.now()): Promise<string | null> {
  if (typeof issuedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(issuedAt)) return "Missing or unreadable issue time";
  const at = Date.parse(issuedAt);
  if (Number.isNaN(at) || now - at > MAX_AGE_MS || at - now > MAX_SKEW_MS) return "This approval has expired; sign again";
  if (typeof signature !== "string" || !isHex(signature) || signature.length < 132 || signature.length > 4096) return "Missing or unreadable signature";
  if (!isAddress(t.clientWallet, { strict: false })) return "This job has no client wallet";
  const address: Address = getAddress(t.clientWallet);
  const ok = await publicClient.verifyMessage({ address, message: approvalMessage(t, issuedAt), signature });
  return ok ? null : "The signature is not from the client wallet on this job";
}
