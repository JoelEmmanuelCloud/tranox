import { formatEther } from "viem";
import { TOKENS } from "../src/config.js";
import { balanceOf, fromUnits } from "../src/erc20.js";
import { agent, publicClient } from "../src/wallet.js";

const address = agent().address;
console.log("Agent:", address);
console.log("CELO :", formatEther(await publicClient.getBalance({ address })));
for (const [sym, addr] of Object.entries(TOKENS)) {
  console.log(`${sym.padEnd(5)}:`, await fromUnits(addr, await balanceOf(addr)));
}
