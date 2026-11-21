import "dotenv/config";
import type { Address, Hex } from "viem";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

export const CHAIN_ID = 42220; // Celo mainnet — only mainnet activity counts

export const env = {
  rpcUrl: process.env.CELO_RPC_URL ?? "https://forno.celo.org",
  tag: () => req("CELO_ATTRIBUTION_TAG"),
  privateKey: () => req("AGENT_PRIVATE_KEY") as Hex,
  textileUrl: process.env.TEXTILE_API_URL ?? "https://api.textilecredit.com/v2",
  textileKey: process.env.TEXTILE_API_KEY || undefined,
  maxPayoutUsdt: Number(process.env.MAX_PAYOUT_USDT ?? 100),
  maxDailyUsdt: Number(process.env.MAX_DAILY_USDT ?? 300),
  pbUrl: process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090",
  pbEmail: process.env.POCKETBASE_ADMIN_EMAIL ?? "",
  pbPassword: process.env.POCKETBASE_ADMIN_PASSWORD ?? "",
  agentCardUri: process.env.AGENT_CARD_URI ?? "",
};

// Celo mainnet token addresses (from the hackathon brief)
export const TOKENS = {
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  cNGN: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
  IDRX: "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22",
  wARS: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D",
  wBRL: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0",
  wMXN: "0x337E7456B420bD3481e7FA61fA9850343d610d34",
  wCOP: "0x8a1D45e102e886510e891d2Ec656a708991e2D76",
} as const satisfies Record<string, Address>;

export type TokenSymbol = keyof typeof TOKENS;

// Corridors that count for the Stablecoin Corridors track (USD₮ <-> local)
export const PAYOUT_CURRENCIES = ["cNGN", "IDRX", "wARS", "wBRL", "wMXN", "wCOP"] as const;
export type PayoutCurrency = (typeof PAYOUT_CURRENCIES)[number];

export const TEXTILE_REACTOR: Address = "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3";
export const ERC8004_IDENTITY_REGISTRY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
