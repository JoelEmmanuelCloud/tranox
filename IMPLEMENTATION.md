# Tranox — Step-by-step build plan

Celo "Agents Open for Business" hackathon · build opens 20 Nov 2026 · **submissions close Mon 7 Dec, 09:00 GMT (04:00 Toronto)** · winners 11 Dec

**What it does:** a client pays a GoWork milestone in USD₮; the agent converts it on Textile FX and pays the freelancer in their local stablecoin on Celo mainnet.

**Tracks:** Stablecoin Corridors (primary, 1st $1,000) · Self Agent ID (stretch, 1st $700). One project can win in up to two tracks.

**Eligible corridors (USD₮ ↔):** cNGN (Nigeria) · IDRX (Indonesia) · wARS (Argentina) · wBRL (Brazil) · wMXN (Mexico) · wCOP (Colombia)

## Status (read first)

**Already scaffolded in this repo — extend it, don't recreate it:**

- `src/config.ts` — env, chain 42220, token addresses, corridors, reactor, ERC-8004 registry
- `src/wallet.ts` — the ONLY way txs are sent; `sendTagged` / `writeTagged` append the attribution tag
- `src/textile.ts` — Textile RFQ v2: preview, firm quote with keyless `takerProof`, approve, swap, submit
- `src/payout.ts` — USD₮ → local stablecoin → transfer to freelancer, with per-payout/daily caps
- `src/erc20.ts` — decimals, balances, tagged transfer
- `src/worker.ts` — polls PocketBase `payouts` collection, executes, writes hashes back
- `scripts/` — `wallet:new`, `balances`, `quote`, `register:agent`, `swap:test`
- `agent-card.json`, `.env.example`, `README.md`
- `npm run typecheck` passes; tag encoding verified (`celo_37620e33107f` round-trips)

**Done:** enrolled on Loops House; tag issued.

**Next up, in order:**

1. PocketBase: add `wallet_address` + `payout_currency` to freelancer profiles; create the `payouts` collection (fields in Step 4); add the hook that queues a payout on milestone approval
2. Fix `login()` in `src/worker.ts` if GoWork runs PocketBase ≥ 0.23 (`_superusers` auth)
3. ~~Verify `npm run quote -- 10` against the live Textile API~~ Done 20 Nov. Celo 42220 is live. Responses come in a `data` field, `expiresAt` is an ISO date, approvals can target `quote.spender`. Liquidity seen on 20 Nov (USD₮ in): cNGN about 42,660 and IDRX about 54,640; wBRL about 9.80, wCOP about 7.65, wARS about 0.72; wMXN had no makers online. Recheck with `npm run quote -- 5` before each payout in the thin corridors.
4. Then the remaining unchecked items below

---

## Step 1 — Register and set up (20–22 Nov)

- [x] Enroll at https://www.loops.house/agents-open-for-business
- [ ] Create a **public GitHub repo** (e.g. `tranox`) — needed for submission and must still resolve at judging
- [ ] Save the attribution tag in `.env`: `CELO_ATTRIBUTION_TAG=celo_37620e33107f`
  - Lost it? Event page, the Celo button in the playground, or `loops project get`
  - Joining a team switches you to the team's tag — decide before sending any transactions
- [ ] Install the Loops agent skill in the repo (needs Node 20.12+, 22 LTS recommended):

```bash
node -v            # nvm use 22 if older
npx loopshouse add agents-open-for-business
```

  - Installs the `loops` CLI, writes this event's skill into your coding agent, signs you in via the browser
  - Re-run any time to pick up the latest sponsors and deadlines
  - Then ask your agent things like "Using Textile's docs, how do I build the takerProof?" or "Save this plan as an artifact called 'MVP scope'"
- [ ] Create the agent hot wallet (fresh key, never reused); store the key in `.env`, never commit it
- [ ] Fund the agent wallet with a little CELO for gas and a small USD₮ float
- [ ] Install deps: `npm i viem @celo/attribution-tags dotenv`
- [ ] Wrap the wallet client so **every** transaction appends the tag:

```ts
import { toDataSuffix } from "@celo/attribution-tags";
import { concat } from "viem";
const TAG = toDataSuffix(process.env.CELO_ATTRIBUTION_TAG!);
// for contract calls: data = concat([encodedCalldata, TAG])
```

- [ ] Register the agent on the **ERC-8004 Identity Registry** from the agent wallet
  - Celo mainnet: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - `register(agentURI)` → agent card JSON with name, description, payout endpoint
- [ ] Add the agent wallet in the playground (**ADD WALLET**) — keep the same wallet for the whole event; your score is tied to it
- [ ] (Recommended) Register with **Self Agent ID** (human-backed identity)

## Step 2 — Recruit real users (21–30 Nov, in parallel)

- [ ] Line up 3–5 GoWork freelancers in any of the six corridor countries
- [ ] Each needs a Celo wallet (MiniPay or Valora) and picks a payout currency
- [ ] Line up at least one client willing to pay small real jobs ($10–$50)
- [ ] Agree on real tasks (logo, translation, bug fix, copywriting)

## Step 3 — Textile FX swap module (22–25 Nov)

Docs: https://fx-docs.textilecredit.com/api/v2/rfq.html — keyless works (no API key needed).

- [ ] `POST /v2/rfq/preview` — indicative price, check each corridor has liquidity
- [ ] `POST /v2/rfq/request` — firm quote
  - `chainId: 42220`, `sellToken: USD₮`, `buyToken: <freelancer's stablecoin>`
  - `sellAmount` **or** `buyAmount` (exactly one), `taker: <agent wallet>`
  - `takerProof`: EIP-712 `TakerControl` signature (valid ~12 h per wallet/chain)
  - client timeout 75 s
  - store `rfqId` and `claimToken`
- [ ] If allowance < `takerPays`: send `transactions.approval` (tagged), wait for confirmation
- [ ] Check `now < quote.expiresAt`, else re-request
- [ ] Send `transactions.swap` from the agent wallet (tagged)
- [ ] `POST /v2/rfq/{id}/submit` with `{ "txHash": "0x…" }` and header `X-Rfq-Claim`
- [ ] Test: one real $5 USD₮ → cNGN swap on mainnet, confirm the tag with `verifyTx`

Token addresses (Celo mainnet):

| Token | Address |
| --- | --- |
| USD₮ | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` |
| IDRX | `0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22` |
| wARS | `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D` |
| wBRL | `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0` |
| wMXN | `0x337E7456B420bD3481e7FA61fA9850343d610d34` |
| wCOP | `0x8a1D45e102e886510e891d2Ec656a708991e2D76` |
| Textile reactor | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |

wFIAT tokens (wARS, wBRL, wMXN, wCOP) use 18 decimals — read `decimals()` for the rest.

## Step 4 — GoWork payout flow (24–28 Nov)

- [ ] PocketBase: add `wallet_address` and `payout_currency` fields to freelancer profiles
- [ ] PocketBase: add a `payouts` collection that `src/worker.ts` reads and writes:
  - `job` (relation), `freelancer` (relation), `freelancer_wallet` (text)
  - `currency` (select: cNGN, IDRX, wARS, wBRL, wMXN, wCOP), `amount_usdt` (number)
  - `status` (select: queued, processing, paid, failed)
  - `rfq_id`, `approval_tx`, `swap_tx`, `payout_tx`, `received_units`, `error` (text)
  - `created` (autodate), used to give up on payouts that wait longer than `MAX_QUEUE_HOURS` for liquidity
  - `paid_at` (date), set when paid; the worker adds up today's `paid` and `processing` amounts on every check so `MAX_DAILY_USDT` holds across restarts
- [ ] Hook on milestone approval → create a `payouts` record with status `queued`
- [ ] Agent worker picks up `queued` payouts:
  1. Confirm the client's USD₮ has arrived (client wallet or GoWork escrow)
  2. Get a Textile quote into the freelancer's currency
  3. Approve + swap (tagged)
  4. Transfer the local stablecoin to the freelancer (tagged)
  5. Write tx hashes back, set status `paid`
- [ ] Guardrails: max per payout, max per day, allowlist of freelancer wallets
  - [x] Per-payout cap (`MAX_PAYOUT_USDT`) fails the payout
  - [x] Daily cap (`MAX_DAILY_USDT`, UTC day) holds the payout until 00:00 UTC. "Spent today" is the highest of: USD₮ the agent wallet sent on-chain today, today's `paid` plus `processing` payouts in PocketBase, and this process's own count. Any USD₮ leaving the agent wallet counts, including `swap:test` and manual transfers
  - [ ] Allowlist of freelancer wallets
- [ ] Retries: `no_quote` → retry later; expired quote → re-request
- [ ] **Milestone: first real mainnet payout to a freelancer by 28 Nov**

## Step 5 — Self Agent ID + x402 (29 Nov–3 Dec, stretch)

- [ ] Expose a payout endpoint other agents can call (`POST /payout`)
- [ ] Charge per call over x402 via Celo's facilitator (https://x402.celo.org); register the PayTo address
- [ ] Serve only client agents with a human-backed Self Agent ID; limit or refuse others
- [ ] Drop this step if it slips — Corridors alone is the main prize

## Step 6 — Real usage (30 Nov–5 Dec)

- [ ] Pay real jobs across as many corridors as your freelancers use
- [ ] Targets: minimum 3 freelancers / 3 tagged conversions / 1 client; good 10+ / 15+ / 3+
- [ ] Fix whatever real users hit
- [ ] Respond to AskBots reviews (GitHub issues on 24 Nov and 4 Dec)
- [ ] Optional: paid calls to services on https://usebuy.ai count as real use

## Step 7 — Submit (5–6 Dec)

- [ ] README: problem, flow diagram, how to run, contract/token addresses
- [ ] Agent ERC-8004 ID and wallet address, attribution tag code
- [ ] Celoscan links to tagged Textile conversions and payouts
- [ ] Named users: freelancer names/handles, countries, jobs done, a short quote from one
- [ ] 2–3 minute demo video
- [ ] Self-evaluate with the Loops skill: "Evaluate my project against the Stablecoin Corridors judging criteria" — fix gaps before submitting
- [ ] Submit on Loops House a day before the 7 Dec 09:00 GMT close

---

## Version control

> Use version control to track your code during the event. Submissions with large single commits or missing histories may be disqualified, as it's important to show your progress throughout the hackathon.

- [ ] Small, frequent commits: one logical change each, roughly under 200 changed lines
- [ ] Push at least daily, so the GitHub history shows steady work from 20 Nov to 7 Dec
- [ ] Never squash, rebase away, or force-push `main`
- [ ] Specific, scoped messages (`textile: retry firm quote on expiry`), never `wip` or `update`
- [ ] `npm run typecheck` before each commit; never commit `.env` or keys
- [ ] Full rules in the project rules file (kept outside the repo)

## Rules to not break

- Celo mainnet only (chain 42220) for counted activity
- Every counted tx carries the tag — untagged txs can never be credited later
- Code written from 20 Nov onward
- Commit history must show progress: no large single commits, no missing history
- No arbitrage, self-trading, or acting as a Textile maker
- Payments must reach recipients outside the team
- Sponsored gas is not a builder contribution

## Key dates

| Date | Event |
| --- | --- |
| Fri 20 Nov | Build opens |
| Tue 24 Nov, 14:00 GMT | Self livestream; AskBots review 1 |
| Wed 25 Nov, 14:00 GMT | Altana livestream |
| Tue 1 Dec, 14:00 GMT | Stablecoin Corridors livestream |
| Fri 4 Dec | AskBots review 2 |
| Mon 7 Dec, 09:00 GMT | Submissions close |
| Fri 11 Dec | Winners announced |

## Links

- Hackathon: https://www.loops.house/agents-open-for-business
- Playground (wallet, tag, agent skill): https://www.loops.house/agents-open-for-business/playground/ideate
- Textile RFQ v2: https://fx-docs.textilecredit.com/api/v2/rfq.html
- Attribution tags: https://docs.celo.org/build-on-celo/attribution-tags
- ERC-8004 on Celo: https://docs.celo.org/build-on-celo/build-with-ai/8004
- Self Agent ID: https://docs.celo.org/build-on-celo/build-with-ai/self-agent-id
- x402 on Celo: https://x402.celo.org
