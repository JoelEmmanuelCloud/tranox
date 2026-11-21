# Tranox — Step-by-step build plan

Celo "Agents Open for Business" hackathon · build opens 20 Nov 2026 · **submissions close Mon 7 Dec, 09:00 GMT (04:00 Toronto)** · winners 11 Dec

**What it does:** a client pays a GoWork milestone in USD₮; the agent converts it on Textile FX and pays the freelancer in their local stablecoin on Celo mainnet.

**Tracks:** Stablecoin Corridors (primary, 1st $1,000) · Self Agent ID (stretch, 1st $700). One project can win in up to two tracks.

**Stablecoin Corridors prizes and scoring:** 1st $1,000, 2nd $600, 3rd $400. Four parts, 25% each: quality of execution, clear value, early traction with tagged mainnet activity, and a named user with a real job done. Half the score is real use, so users matter as much as code.

**Corridors entry requirements** (not scored in the track without all three):
- At least one tagged Textile conversion on mainnet, as part of the product flow
- At least one local-stablecoin payment that reaches someone outside the team
- An ERC-8004 identity for the agent

**Other tracks considered:**
- Self Agent ID (1st $700, 2nd $300): needs Self Agent ID plus x402 payments. Scored integration 30%, idea 30%, named user 25%, real use 15%. This is Step 5
- Altana Agent Wallets (1st $750 + 25,000 XP, 2nd $250 + 10,000 XP): the agent spends from a user's Altana wallet under a capped, revocable session key. Skipped: it changes how the agent wallet works and clashes with one agent wallet for the whole event
- Agent Vault checkouts (1st $700, 2nd $300): not a fit for Tranox

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

1. ~~PocketBase setup~~ Done 20 Nov. PocketBase 0.40.6 lives in `pocketbase/` (migrations in `pb_migrations`, milestone hook in `pb_hooks`); `npm run pb` runs it locally. Collections: `freelancers`, `jobs`, `milestones`, `payouts`, `worker_locks`. To use an existing GoWork PocketBase instead, copy `pocketbase/pb_migrations` and `pocketbase/pb_hooks` to that server and run `migrate up`
2. ~~Fix `login()`~~ Done 20 Nov: SDK 0.29, `_superusers` auth
3. ~~Verify `npm run quote -- 10` against the live Textile API~~ Done 20 Nov. Celo 42220 is live. Responses come in a `data` field, `expiresAt` is an ISO date, approvals can target `quote.spender`. Liquidity seen on 20 Nov (USD₮ in): cNGN about 42,660 and IDRX about 54,640; wBRL about 9.80, wCOP about 7.65, wARS about 0.72; wMXN had no makers online. Recheck with `npm run quote -- 5` before each payout in the thin corridors.
4. Then the remaining unchecked items below

---

## Step 1 — Register and set up (20–22 Nov)

- [x] Enroll at https://www.loops.house/agents-open-for-business
- [x] Create a **public GitHub repo** (e.g. `tranox`) — needed for submission and must still resolve at judging
- [x] Save the attribution tag in `.env`: `CELO_ATTRIBUTION_TAG=celo_37620e33107f`
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
- [x] Install deps: `npm i viem @celo/attribution-tags dotenv`
- [x] Wrap the wallet client so **every** transaction appends the tag:

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
- [ ] Keep every user independent: never send a freelancer or client gas money or USD₮, from the team or from the team's main funder. Their wallets count only if someone else funded them. New Celo users are fine
- [ ] Note how you reached each user; the submission must say so

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

- [x] PocketBase: `freelancers` collection with `wallet_address` (checked format) and `payout_currency`; `jobs` link a freelancer; `milestones` hold `amount_usdt` and `status`
- [x] PocketBase: add a `payouts` collection that `src/worker.ts` reads and writes:
  - `job` (relation), `freelancer` (relation), `freelancer_wallet` (text)
  - `currency` (select: cNGN, IDRX, wARS, wBRL, wMXN, wCOP), `amount_usdt` (number)
  - `status` (select: queued, processing, paid, failed)
  - `rfq_id`, `approval_tx`, `swap_tx`, `payout_tx`, `received_units`, `error` (text)
  - `created` (autodate), used to give up on payouts that wait longer than `MAX_QUEUE_HOURS` for liquidity
  - `paid_at` (date), set when paid; the worker adds up today's `paid` and `processing` amounts on every check so `MAX_DAILY_USDT` holds across restarts
  - `source` (text): `manual` for `swap:test` payouts, empty for milestone payouts. `job` and `freelancer` must be optional so `swap:test` can record its payouts
  - `started_block` (number), the Celo block when processing began. After a crash, or an error that may have come after a transaction was sent, the worker checks the chain from this block: a transfer to the freelancer marks the payout `paid`; a landed swap gets its transfer finished; nothing sent puts it back in the queue. While any payout cannot be settled this way it stays `processing`, its `error` says why, and no new payouts start. Only one worker runs payouts at a time; see `worker_locks` below
- [x] PocketBase: add a `worker_locks` collection for the single-worker lease:
  - `name` (text, unique index), `owner` (text), `heartbeat_at` (date)
  - No API rules (superuser only). The worker holds the `payout-worker` row, refreshes it every check and before each payout, and deletes it on Ctrl+C. A second worker waits; it takes over only if the holder has not refreshed for 10 minutes
- [x] Hook on milestone approval → create a `payouts` record with status `queued` (`pocketbase/pb_hooks/milestones.pb.js`)
  - Approval and payout are saved in one transaction; if the payout cannot be saved, the approval is undone
  - Approval is refused if the freelancer has no valid wallet or currency
  - New milestones must start `pending`; once approved, `status`, `amount_usdt` and `job` are locked
  - A unique index allows at most one payout per milestone
- [x] Client funds check (`src/funding.ts`): the client sends USD₮ straight to the agent wallet from the `client_wallet` set on the job
  - Approval is refused if the job has no valid `client_wallet`, or if it is the freelancer's own wallet. The hook copies it to the payout in lowercase, with `funded_since` set to the job's creation time
  - Before a milestone payout starts, the worker adds up all USD₮ this client wallet has sent the agent wallet since its earliest `funded_since`. That total must cover this payout plus all of the client's `paid` and `processing` payouts. If not, the payout stays `queued`, its `error` says how much has arrived and how much is needed, and it is checked again every 2 minutes. It never gives up waiting for funds
  - When funds are confirmed the worker sets `funded_at`. The `MAX_QUEUE_HOURS` wait for liquidity counts from then, not from approval
  - `swap:test` payouts (`source = manual`) skip the check
- [ ] Agent worker picks up `queued` payouts:
  1. ~~Confirm the client's USD₮ has arrived~~ Done 20 Nov, see the funds check above
  2. Get a Textile quote into the freelancer's currency
  3. Approve + swap (tagged)
  4. Transfer the local stablecoin to the freelancer (tagged)
  5. Write tx hashes back, set status `paid`
- [x] Guardrails: max per payout, max per day, allowlist of freelancer wallets
  - [x] Per-payout cap (`MAX_PAYOUT_USDT`) fails the payout
  - [x] Daily cap (`MAX_DAILY_USDT`, UTC day) holds the payout until 00:00 UTC. "Spent today" is the highest of: USD₮ the agent wallet sent on-chain today, today's `paid` plus `processing` payouts in PocketBase, and this process's own count. Any USD₮ leaving the agent wallet counts, including `swap:test` and manual transfers
  - [x] `swap:test` takes the same lock as the worker, refuses to run while any payout is `processing`, and records itself as a `payouts` row (`source = manual`) so recovery and the daily cap see it. `--standalone` skips all of this and is only for tests before PocketBase is set up
  - [x] Allowlist of freelancer wallets (`FREELANCER_ALLOWLIST` in `.env`, comma-separated). Kept out of PocketBase so a changed profile wallet cannot redirect a payout. Empty list means no payouts. Paying the agent wallet is refused. Add each freelancer's wallet here once you confirm it with them directly, then restart the worker
- [x] Retries (checked against Textile's errors page, https://fx-docs.textilecredit.com/api/v2/errors.html):
  - No quote or not enough depth: stays `queued`, waits `retryAfterMs` when Textile gives one, else 60 s (10 min when the corridor is too shallow)
  - Quote expired before the swap: a new quote is requested on the next try
  - Textile 429, 500, 502, 503, timeouts and dropped connections: stays `queued`. A 429 waits the `Retry-After` time when sent, else 60 s
  - Swap reverted on-chain (for example after the order deadline): nothing was swapped, so it stays `queued` with a fresh quote next time. After 3 reverted swaps the payout fails, so a broken swap cannot keep spending gas
  - All of these give up after `MAX_QUEUE_HOURS`. Other Textile errors (400, 401, 403, 404, 409) fail the payout at once, as the docs say they need a fix, not a retry
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
- [ ] Optional: paid calls to services on https://usebuy.ai count as real use (`npm install -g @celo/buy`, Node 22+)

## Step 7 — Submit (5–6 Dec)

- [ ] README: problem, flow diagram, how to run, contract/token addresses
- [ ] Agent ERC-8004 ID and wallet address, attribution tag code
- [ ] Celoscan links to tagged Textile conversions and payouts
- [ ] Named users: freelancer names/handles, countries, jobs done, a short quote from one
- [ ] 2–3 minute demo video
- [ ] In the submission: who the users are, how you reached them, and how gas is paid (the agent wallet pays its own gas; no relayer or sponsored gas)
- [ ] Register a payout wallet for prizes; they are paid in CELO at the USD value
- [ ] Follow @Celo and @CeloDevs on X (required)
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
- A user counts only if their wallet is outside the team and was not funded by the team or its main funder. Liquidity pools, routers, Textile makers and exchange wallets never count
- Activity is reviewed before judging. Any concern is raised privately first, with 48 hours to reply

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
- Agent explorer: https://8004scan.io

## Extras worth using

- Chainstack Growth plan, free for 3 months: a faster Celo connection than the free public one (`CELO_RPC_URL`), which limits how many blocks one log query can cover
- Celo developer office hours, Thursdays 12:00 GMT
- Help: Telegram https://t.me/celoagenthackathons
