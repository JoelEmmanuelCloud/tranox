// Generates a fresh agent wallet. Put the key in .env (never commit it).
// Use this SAME wallet for the whole event — your score is tied to it.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const pk = generatePrivateKey();
const acct = privateKeyToAccount(pk);
console.log("AGENT_PRIVATE_KEY=" + pk);
console.log("Agent address:   " + acct.address);
console.log("\nNext: add the address under ADD WALLET in the Loops playground, then fund it with a little CELO + USD₮.");
