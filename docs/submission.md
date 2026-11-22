# Tranox: submission draft

Draft answers for the Loops House form, Agents Open for Business. Items marked **TODO** need information only the team has.

## Basics

- **Project name:** Tranox
- **Tagline (under 250 characters):** Get paid abroad, spend it at home. Clients pay a milestone in USD₮; Tranox converts it on Textile FX and pays the freelancer naira, rupiah, pesos or reais on Celo, minutes after the work is approved.
- **Repository:** https://github.com/JoelEmmanuelCloud/tranox
- **Demo URL:** https://tranoxweb.com
- **Walkthrough video:** **TODO** (script in `docs/demo-script.md`)
- **Screenshots:** home page, client job page, freelancer payout page (from tranoxweb.com)
- **Logo:** `web/logo.png`
- **Tracks:** Stablecoin Corridors (1st, 2nd and 3rd place bounties)

## Description

Freelancers in Nigeria, Indonesia and Latin America often work for clients abroad who pay in dollars. The money arrives days later through a bank wire or a payout platform, fees come off at each step, and the freelancer still has to change dollars into the money they spend.

Tranox is an agent that removes those steps. The client pays each milestone in USD₮ from their own wallet, such as MiniPay, on the job page. When the work is done, the client approves the milestone with a free signature from the same wallet. The Tranox agent then checks on-chain that the client's money has arrived, gets a firm quote on Textile FX, swaps the USD₮ into the freelancer's currency (cNGN, IDRX, wARS, wBRL, wMXN or wCOP), and sends it straight to the freelancer's phone wallet. Every step is a Celo transaction with the attribution tag, and both the client and the freelancer can follow it on their own page with Celoscan links.

Safety rules built into the agent:

- No payout without the money: a milestone is paid only after the client's USD₮ for it has arrived on-chain.
- Only the client can approve: approval needs a signature from the client wallet on the job, bound to the milestone, job and amount, valid for 10 minutes.
- Only confirmed wallets: freelancer wallets must be on an allowlist confirmed with each freelancer; a changed profile cannot redirect a payout.
- Spending limits per payout and per day, counted from the chain so restarts do not reset them.
- Crash recovery: after an interruption the worker reads the chain and finishes, re-queues or holds each payout instead of guessing.
- Retries that follow Textile FX's documented errors, and a 1 USD₮ minimum that matches Textile's firm-quote minimum.

Wallets: clients pay from MiniPay or any Celo wallet. Freelancers receive into a wallet that can show their local stablecoin, such as MetaMask on Celo, because MiniPay only displays USD₮, USDC and USDm. The freelancer page explains this and has a one-tap "Add token to my wallet" button plus the token address.

Production setup: the pages and data routes run on Vercel at tranoxweb.com. PocketBase and the payout worker run on a Google Compute Engine server at api.tranoxweb.com. The agent's private key exists only on that server.

## Required answers

- **Agent wallet:** `0xB1eF0cEa020B273E1c30370a787B9447DfE14706`
- **ERC-8004 agent ID:** `10085` (registration: https://celoscan.io/tx/0xe2f7143fbcf41ba8d18d5b29ab92ef64fa65dbb13b9bcb60389aeb3ffb8b3d1e)
- **Self Agent ID (mainnet agentId):** `210`, registered 22 Nov 2026 in the Self Agent Registry on Celo mainnet (`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`). Badge key `0x25f2102457d7255C4B38967592c1259c88e145b6`, owned by a team member's wallet after a passport check that shares only "over 18" and "not on a sanctions list". The badge key only proves a human is behind the agent; all payments still go through the one agent wallet.
- **Attribution tag:** `celo_37620e33107f`
- **Payout wallet on Celo:** `0x6F25FC9CB7D0a0bf92dcE5514103232fa38ba2Bc` (the founder's MiniPay wallet, separate from the agent wallet)
- **Named user:** Barok, a freelancer in Indonesia, outside the team. For the "Project documentation" milestone the client paid 1 USD₮ from MiniPay on the job page and approved it with a signature; about a minute later Barok received 18,343.62 IDRX in his wallet. Across two payouts he has received 36,693.97 IDRX, all with public, tagged transactions. The client on this job was the founder paying for real work. Quote from Barok: "Receiving the money was relatively easy."
- **Team contacts:** Joel Emmanuel (founder). Email and Telegram are entered in the submission form only, not in this public repo.
- **Founder or project handles on X:** [@joelCloud899799](https://x.com/joelCloud899799)
- **Follow @Celo and @CeloDevs on X:** yes, confirmed by the founder on 22 Nov 2026

## Stablecoin Corridors track details

- **Wallets used:** agent `0xB1eF0cEa020B273E1c30370a787B9447DfE14706`
- **Corridors:** USD₮ to cNGN, IDRX, wARS, wBRL, wMXN and wCOP; first live payout USD₮ to IDRX
- **Tagged Textile FX conversion and payout, 21 Nov 2026:** 1 USD₮ converted to 18,350.35 IDRX and paid to a freelancer outside the team
  - USD₮ approval: https://celoscan.io/tx/0x7e4fbbe99cf24a9269834821e4ebd8959e638717079161024fb72ea4c94ac82e
  - Swap on Textile FX: https://celoscan.io/tx/0xeabac9235657087c5219b0df07e445e578d25da9401a8bb4b55036ba16bdf993
  - Payout to the freelancer: https://celoscan.io/tx/0x2ea6b85d3ac9907c79ab61674cb21dd47a3109567b7bc8aeaa9ef20413a56178
- **First full client-funded milestone, 22 Nov 2026 ("Project documentation", 1 USD₮, paid to Barok in IDRX):** the client paid from MiniPay on the job page, approved with a signature, and the agent checked the funds, swapped and paid, all tagged
  - Client payment: https://celoscan.io/tx/0x8c0c53322b1595fa8a54349824a608d304dbcd2baee5a3d91db5fd5a2940308d
  - Swap on Textile FX (1 USD₮ to 18,343.62 IDRX): https://celoscan.io/tx/0x8bd24a0b0ab51c9899284bf34c51aeb8ba564a8966c2ce70867ee4a8aa955b74
  - Payout to Barok: https://celoscan.io/tx/0x6d0de440990be68dc635c5dea5f1860a5274874f4fe9c988d50746b67474a75d
- **Client payment through the job page, tagged by the page:** https://celoscan.io/tx/0x3d6f3415eb3201bde488c4de31f638a5a15e73d03e141d07cbc8b92abda67c45
- **Gas:** no relayer and no sponsored gas. The agent pays its own gas in CELO for registration, approvals, swaps and payouts. Clients pay their own network fee in MiniPay when they pay a milestone.

## How users were reached

**TODO:** how Barok and the clients were found (for example: personal network, freelancer communities), in one or two sentences.
