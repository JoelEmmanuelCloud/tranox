import { erc20Abi, parseUnits, formatUnits, type Address, type Hex } from "viem";
import { agent, publicClient, writeTagged } from "./wallet.js";

export async function decimals(token: Address): Promise<number> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
}

export async function balanceOf(token: Address, owner: Address = agent().address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export async function toUnits(token: Address, amount: string): Promise<bigint> {
  return parseUnits(amount, await decimals(token));
}

export async function fromUnits(token: Address, amount: bigint): Promise<string> {
  return formatUnits(amount, await decimals(token));
}

export async function transferTagged(token: Address, to: Address, amount: bigint): Promise<Hex> {
  return writeTagged({ address: token, abi: erc20Abi, functionName: "transfer", args: [to, amount] });
}
