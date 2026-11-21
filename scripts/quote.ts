// Indicative prices for every corridor — nothing signed or reserved.
// Usage: npm run quote -- 10   (USD₮ amount, default 10)
import { PAYOUT_CURRENCIES, TOKENS } from "../src/config.js";
import { toUnits } from "../src/erc20.js";
import { preview } from "../src/textile.js";

const amount = process.argv[2] ?? "10";
const sellAmount = await toUnits(TOKENS.USDT, amount);
for (const c of PAYOUT_CURRENCIES) {
  try {
    console.log(c, JSON.stringify(await preview({ sellToken: TOKENS.USDT, buyToken: TOKENS[c], sellAmount })));
  } catch (e) {
    console.log(c, "ERROR", e instanceof Error ? e.message : e);
  }
}
