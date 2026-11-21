import type { RecordModel } from "pocketbase";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { TOKENS } from "./config.js";
import { pb } from "./db.js";
import { decimals } from "./erc20.js";
import { receivedSince } from "./spend.js";
import { agent } from "./wallet.js";

export type Funding = { kind: "funded" } | { kind: "wait"; reason: string } | { kind: "refuse"; reason: string };

export async function checkFunding(rec: RecordModel): Promise<Funding> {
  if (rec.source !== "milestone") return { kind: "funded" };

  const raw = String(rec.client_wallet ?? "");
  if (!isAddress(raw, { strict: false })) return { kind: "refuse", reason: "Payout has no valid client_wallet, so client funds cannot be checked" };
  const client = getAddress(raw);
  const self = agent().address;
  if (client === self) return { kind: "refuse", reason: "client_wallet is the agent wallet; refusing to fund a payout from itself" };

  const lower = client.toLowerCase();
  const earliest = await pb
    .collection("payouts")
    .getFirstListItem(pb.filter('client_wallet = {:w} && funded_since != ""', { w: lower }), { sort: "funded_since", fields: "funded_since" });
  const sinceMs = Date.parse(String(earliest.funded_since));
  if (Number.isNaN(sinceMs)) return { kind: "refuse", reason: "Payout has no readable funded_since, so client funds cannot be checked" };

  const dec = await decimals(TOKENS.USDT);
  const others = await pb.collection("payouts").getFullList({
    filter: pb.filter('client_wallet = {:w} && id != {:id} && (status = "paid" || status = "processing")', { w: lower, id: rec.id }),
    fields: "amount_usdt",
  });
  const units = (amount: unknown) => parseUnits(String(Number(amount)), dec);
  const used = others.reduce((sum, r) => sum + units(r.amount_usdt), 0n);
  const needed = used + units(rec.amount_usdt);
  const received = await receivedSince(TOKENS.USDT, client, self, sinceMs);

  if (received >= needed) return { kind: "funded" };
  return {
    kind: "wait",
    reason: `Waiting for client funds: ${client} has sent ${formatUnits(received, dec)} USDT to the agent wallet, ${formatUnits(needed, dec)} USDT is needed to cover this and earlier payouts`,
  };
}
