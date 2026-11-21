import { formatUnits } from "viem";
import { PAYOUT_CURRENCIES, TOKENS } from "../src/config.js";
import { decimals } from "../src/erc20.js";
import { preview } from "../src/textile.js";

const amount = process.argv[2] ?? "10";
if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw new Error(`Amount must be a positive number, got "${amount}"`);

const usdtDecimals = await decimals(TOKENS.USDT);
const sellAmount = BigInt(Math.round(Number(amount) * 10 ** usdtDecimals));
const usdt = (v: string | undefined) => (v ? formatUnits(BigInt(v), usdtDecimals) : "?");

for (const c of PAYOUT_CURRENCIES) {
  try {
    const p = await preview({ sellToken: TOKENS.USDT, buyToken: TOKENS[c], sellAmount });
    if (p.status !== "preview" || !p.buyAmount) {
      console.log(`${c.padEnd(5)} NO QUOTE ${p.reason ?? ""} depth ${usdt(p.availableSellAmount)} USDT${p.retryAfterMs ? ` retry in ${p.retryAfterMs}ms` : ""}`);
      continue;
    }
    const received = Number(formatUnits(BigInt(p.buyAmount), await decimals(TOKENS[c])));
    console.log(
      `${c.padEnd(5)} ${amount} USDT -> ${received.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${c}` +
        ` | ${(received / Number(amount)).toLocaleString("en-US", { maximumFractionDigits: 4 })} per USDT` +
        ` | fee ${usdt(p.feeAmount)} USDT | depth ${usdt(p.availableSellAmount)} USDT`,
    );
  } catch (e) {
    console.log(`${c.padEnd(5)} ERROR ${e instanceof Error ? e.message : e}`);
  }
}
