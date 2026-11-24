# Tranox: submission draft

Draft answers for the Loops House form, Agents Open for Business. Items marked **TODO** need information only the team has.

## Basics

- **Project name:** Tranox
- **Tagline (under 250 characters):** Get paid abroad, spend it at home. Clients pay a milestone in USD₮; Tranox converts it on Textile FX and pays the freelancer naira, rupiah, pesos or reais on Celo, minutes after the work is approved.
- **Repository:** https://github.com/JoelEmmanuelCloud/tranox
- **Demo URL:** https://tranoxweb.com
- **Walkthrough video:** https://youtu.be/qiLNXxhiJPU (2:01, unlisted; script in `docs/demo-script.md`)
- **Screenshots:** home page, client job page, freelancer payout page (from tranoxweb.com)
- **Logo:** `web/logo.png`
- **Tracks:** Stablecoin Corridors (1st, 2nd and 3rd place bounties)

## Description

Freelancers in Nigeria, Indonesia and Latin America often work for clients abroad who pay in dollars. The money arrives days later through a bank wire or a payout platform, fees come off at each step, and the freelancer still has to change dollars into the money they spend.

Tranox is an agent that removes those steps. The client pays each milestone in USD₮ from their own wallet, such as MiniPay, on the job page. When the work is done, the client approves the milestone with a free signature from the same wallet. The Tranox agent then checks on-chain that the client's money has arrived, gets a firm quote on Textile FX, swaps the USD₮ into the freelancer's currency (cNGN, IDRX, wARS, wBRL, wMXN or wCOP), and sends it straight to the freelancer's phone wallet. Every step is a Celo transaction with the attribution tag, and both the client and the freelancer can follow it on their own page with Celoscan links.

Safety rules built into the agent:

- No payout without the money: a milestone is paid only after the client's USD₮ for it has arrived on-chain.
- Only the client can approve: approval needs a signature from the client wallet on the job, bound to the milestone, job and amount, valid for 10 minutes.
- Only allowlisted wallets: freelancer wallets must be on the agent's allowlist; a changed profile cannot redirect a payout.
- Spending limits per payout and per day, counted from the chain so restarts do not reset them.
- Crash recovery: after an interruption the worker reads the chain and finishes, re-queues or holds each payout instead of guessing.
- Retries that follow Textile FX's documented errors, and a 1 USD₮ minimum that matches Textile's firm-quote minimum.

Wallets: clients pay from MiniPay or any Celo wallet. Freelancers receive into a wallet that can show their local stablecoin, such as MetaMask on Celo, because MiniPay only displays USD₮, USDC and USDm. The freelancer page explains this and has a button that asks the wallet to add the token (MetaMask refused cNGN in one test), plus the token address to add by hand.

Production setup: the pages and data routes run on Vercel at tranoxweb.com. PocketBase and the payout worker run on a Google Compute Engine server at api.tranoxweb.com. The live worker runs on that server. The agent's key is also kept on the founder's laptop for manual runs. It is not on Vercel or in the repo.

## Required answers

- **Agent wallet:** `0xB1eF0cEa020B273E1c30370a787B9447DfE14706`
- **ERC-8004 agent ID:** `10085` (registration: https://celoscan.io/tx/0xe2f7143fbcf41ba8d18d5b29ab92ef64fa65dbb13b9bcb60389aeb3ffb8b3d1e)
- **Self Agent ID (mainnet agentId):** `210`, registered 22 Nov 2026 in the Self Agent Registry on Celo mainnet (`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`). Badge key `0x25f2102457d7255C4B38967592c1259c88e145b6`, owned by a team member's wallet after a passport check that shares only "over 18" and "not on a sanctions list". The badge key only proves a human is behind the agent; all payments still go through the one agent wallet.
- **Attribution tag:** `celo_37620e33107f`
- **Payout wallet on Celo:** `0x6F25FC9CB7D0a0bf92dcE5514103232fa38ba2Bc` (the founder's MiniPay wallet, separate from the agent wallet)
- **Named user:** Godwin, a mobile developer in Port Harcourt, Nigeria, was paid 1,455.06 cNGN for "App screen fix", 35 seconds after approval. His client, Francis in Accra, Ghana, paid 1 USD₮ from his own MiniPay balance, with no top-up from us.

  Barok, a freelancer in Indonesia, received 55,054.10 IDRX in three payouts: one was our own test run, and two were paid by the founder as client. For the last one, the agent first sent the client wallet 0.7 USD₮. Barok said: "Receiving the money was relatively easy."

  The founder confirms both freelancers are outside the team and hold their own wallets. Users came from the founder's network. We have no measured time or cost savings yet.
- **Team contacts:** Joel Emmanuel (founder). Email and Telegram are entered in the submission form only, not in this public repo.
- **Founder or project handles on X:** [@joelCloud899799](https://x.com/joelCloud899799)
- **Follow @Celo and @CeloDevs on X:** yes, confirmed by the founder on 22 Nov 2026

## Stablecoin Corridors track details

- **Wallets used:** agent `0xB1eF0cEa020B273E1c30370a787B9447DfE14706`, client Francis `0x7F985C1506132DF93cBF9da5B50CeEb93a9b053b`, founder as client `0x6F25FC9CB7D0a0bf92dcE5514103232fa38ba2Bc`, freelancers Godwin `0x739fBF68a0d1fb70653Fa5D61c89845c00E1dC24` and Barok `0x105b0215a9eAB3db8AC67664Dde4cE482a5EB063`
- **Corridors:** USD₮ to cNGN, IDRX, wARS, wBRL, wMXN and wCOP; live payouts so far USD₮ to cNGN and USD₮ to IDRX
- **Our own test run, no client, 21 Nov 2026:** 1 USD₮ converted to 18,350.35 IDRX and paid to Barok
  - USD₮ approval: https://celoscan.io/tx/0x7e4fbbe99cf24a9269834821e4ebd8959e638717079161024fb72ea4c94ac82e
  - Swap on Textile FX: https://celoscan.io/tx/0xeabac9235657087c5219b0df07e445e578d25da9401a8bb4b55036ba16bdf993
  - Payout to the freelancer: https://celoscan.io/tx/0x2ea6b85d3ac9907c79ab61674cb21dd47a3109567b7bc8aeaa9ef20413a56178
- **Francis in Accra pays Godwin in Port Harcourt, 23 Nov 2026 ("App screen fix", 1 USD₮ to 1,455.06 cNGN, paid 35 seconds after approval):**
  - Client payment: https://celoscan.io/tx/0x40507e888c273ff724bfc9af92cd72710f42d4feed02ee23fc01fb4ed1c11305
  - USD₮ approval: https://celoscan.io/tx/0xe9e3df3e7386215a18f874d21a9e25e3892ec8068d8e66e7a247d092adbc3dac
  - Swap on Textile FX: https://celoscan.io/tx/0x764896dbab69a3d6cb973cb0ca4c711ed1f039c1695f1ea08dbb74623fc23ffb
  - Payout to Godwin: https://celoscan.io/tx/0xc8123fbfa64bfa1af430b472c914880502d136d574e2fca08c5aad55cf1eae06
- **First full milestone paid through the job page, with the founder as client, 22 Nov 2026 ("Project documentation", 1 USD₮, paid to Barok in IDRX):** the client paid from MiniPay on the job page, approved with a signature, and the agent checked the funds, swapped and paid, all tagged
  - Client payment: https://celoscan.io/tx/0x8c0c53322b1595fa8a54349824a608d304dbcd2baee5a3d91db5fd5a2940308d
  - Swap on Textile FX (1 USD₮ to 18,343.62 IDRX): https://celoscan.io/tx/0x8bd24a0b0ab51c9899284bf34c51aeb8ba564a8966c2ce70867ee4a8aa955b74
  - Payout to Barok: https://celoscan.io/tx/0x6d0de440990be68dc635c5dea5f1860a5274874f4fe9c988d50746b67474a75d
- **Second milestone, 22 Nov 2026 ("Documentation update", 1 USD₮, paid to Barok in IDRX 23 seconds after approval):** recorded on the redesigned job page in MiniPay
  - Client payment: https://celoscan.io/tx/0xb8bd00ddf90a66ab49719f4b7b8fd0ad62fba6b03e901eb09628272618e59bd5
  - USD₮ approval: https://celoscan.io/tx/0x803ceed2e98df03c84c4025a4ced1e2fa5e53197996839ee6205d126dcb933c3
  - Swap on Textile FX (1 USD₮ to 18,360.13 IDRX): https://celoscan.io/tx/0x337067070276cb0b583028aa2a15471b3c825355369c05440cfd0ff9a0e949e4
  - Payout to Barok: https://celoscan.io/tx/0x9b1f0bc7e85bed1e9edd028001c5949874499e4e72bb44367cf2b61a3ec33636
  - Funding note: the client wallet was short of 1 USD₮, so the agent sent it 0.7 USD₮ first (https://celoscan.io/tx/0x30e11cb40a3f256ea4ce0fc9239b3915806fac483a78839f2e6e6a30ec01aff3). We list it so nobody mistakes it for outside client money.
- **Client payment through the job page, tagged by the page:** https://celoscan.io/tx/0x3d6f3415eb3201bde488c4de31f638a5a15e73d03e141d07cbc8b92abda67c45
- **Gas:** no relayer and no sponsored gas. The agent pays its own gas in CELO for registration, approvals, swaps and payouts. Clients pay their own network fee in MiniPay when they pay a milestone.

## How users were reached

Francis, Godwin and Barok came from the founder's network.
