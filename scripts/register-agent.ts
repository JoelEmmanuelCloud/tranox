import { parseAbi } from "viem";
import { ERC8004_IDENTITY_REGISTRY, env } from "../src/config.js";
import { agent, writeTagged } from "../src/wallet.js";

if (!env.agentCardUri) throw new Error("Set AGENT_CARD_URI (hosted agent-card.json) first");

const abi = parseAbi(["function register(string agentURI) returns (uint256 agentId)"]);
console.log("Registering", agent().address, "with", env.agentCardUri);
const hash = await writeTagged({ address: ERC8004_IDENTITY_REGISTRY, abi, functionName: "register", args: [env.agentCardUri] });
console.log("Registered. tx:", `https://celoscan.io/tx/${hash}`);
console.log("Find the agent ID in the Transfer event (tokenId) or on https://8004scan.io");
