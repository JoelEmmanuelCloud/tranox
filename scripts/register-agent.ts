import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAddress, parseAbi, parseEventLogs } from "viem";
import { CHAIN_ID, ERC8004_IDENTITY_REGISTRY, env } from "../src/config.js";
import { agent, publicClient, writeTagged } from "../src/wallet.js";

const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
const registry = `eip155:${CHAIN_ID}:${ERC8004_IDENTITY_REGISTRY}`;
const cardPath = join(import.meta.dirname, "..", "agent-card.json");

type Card = { type?: string; name?: string; registrations?: { agentId: number; agentRegistry: string }[] };

const local: Card = JSON.parse(readFileSync(cardPath, "utf8"));
const existing = local.registrations?.find((r) => r.agentRegistry === registry);
if (existing) throw new Error(`agent-card.json already records agent ID ${existing.agentId} on ${registry}; not registering again`);

if (!env.agentCardUri) throw new Error("Set AGENT_CARD_URI (hosted agent-card.json) first");
const res = await fetch(env.agentCardUri, { signal: AbortSignal.timeout(15_000) });
if (!res.ok) throw new Error(`AGENT_CARD_URI returned HTTP ${res.status}; push agent-card.json and check the link first`);
const hosted: Card = await res.json().catch(() => {
  throw new Error("AGENT_CARD_URI does not return JSON");
});
if (hosted.type !== "https://eips.ethereum.org/EIPS/eip-8004#registration-v1" || !hosted.name) {
  throw new Error("The card at AGENT_CARD_URI is not an ERC-8004 registration file");
}

const self = agent().address;
const owned = await publicClient.readContract({ address: ERC8004_IDENTITY_REGISTRY, abi, functionName: "balanceOf", args: [self] });
if (owned > 0n) throw new Error(`${self} already owns ${owned} ERC-8004 identit${owned === 1n ? "y" : "ies"}; look it up on https://8004scan.io instead of registering again`);

console.log("Registering", self, "with", env.agentCardUri);
const hash = await writeTagged({ address: ERC8004_IDENTITY_REGISTRY, abi, functionName: "register", args: [env.agentCardUri] });
console.log("Registered. tx:", `https://celoscan.io/tx/${hash}`);

const receipt = await publicClient.getTransactionReceipt({ hash });
const event = parseEventLogs({ abi, eventName: "Registered", logs: receipt.logs }).find(
  (l) => getAddress(l.address) === getAddress(ERC8004_IDENTITY_REGISTRY) && getAddress(l.args.owner) === self,
);
if (!event) throw new Error(`No Registered event for ${self} in ${hash}; find the agent ID on https://8004scan.io`);
const agentId = Number(event.args.agentId);

local.registrations = [...(local.registrations ?? []), { agentId, agentRegistry: registry }];
writeFileSync(cardPath, JSON.stringify(local, null, 2) + "\n");
console.log("Agent ID:", agentId);
console.log("Saved the registration to agent-card.json. Commit and push it so the hosted card lists it too.");
