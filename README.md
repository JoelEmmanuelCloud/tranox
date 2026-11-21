# Tranox

Pays GoWork freelancers in their **local stablecoin** on Celo. A client pays a milestone in USD₮; the agent converts it on **Textile FX** and sends the freelancer cNGN, IDRX, wARS, wBRL, wMXN or wCOP. Every transaction carries the Celo attribution tag.

Built for Celo's **Agents Open for Business** hackathon (Stablecoin Corridors track).

## Flow

1. Client funds the job in USD₮
2. GoWork (PocketBase) marks a milestone approved → a `payouts` record is queued
3. Agent gets a firm Textile FX quote, approves and swaps (tagged)
4. Agent transfers the local stablecoin to the freelancer (tagged) and writes tx hashes back

## Setup

```bash
npm install
cp .env.example .env
npm run wallet:new          # paste AGENT_PRIVATE_KEY into .env
npm run balances            # after funding with CELO + USD₮
npm run quote -- 10         # indicative prices for every corridor
npm run register:agent      # ERC-8004 identity (host agent-card.json first)
npm run swap:test -- <wallet> cNGN 5   # REAL mainnet payout, recorded in PocketBase
npm run swap:test -- <wallet> cNGN 5 --standalone   # before PocketBase exists, with no worker running
npm run worker              # process queued GoWork payouts
```

## Celo mainnet addresses

| | Address |
| --- | --- |
| USD₮ | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` |
| IDRX | `0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22` |
| wARS | `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D` |
| wBRL | `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0` |
| wMXN | `0x337E7456B420bD3481e7FA61fA9850343d610d34` |
| wCOP | `0x8a1D45e102e886510e891d2Ec656a708991e2D76` |
| Textile reactor | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

## Hackathon details

- Attribution tag: `celo_37620e33107f`
- Agent wallet: _TBD_
- ERC-8004 agent ID: _TBD_
- Tagged txs: _links go here_
