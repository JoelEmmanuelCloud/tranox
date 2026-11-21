import { toDataSuffix } from "@celo/attribution-tags";
import {
  concat,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { env } from "./config.js";

/**
 * The ONE place transactions leave the agent. Every tx gets the attribution
 * tag appended to its calldata (ERC-8021). Untagged txs are never credited.
 */
export const account = privateKeyToAccount(env.privateKey());
export const publicClient = createPublicClient({ chain: celo, transport: http(env.rpcUrl) });
const walletClient = createWalletClient({ account, chain: celo, transport: http(env.rpcUrl) });

const TAG = toDataSuffix(env.tag()) as Hex;

export function withTag(data: Hex | undefined): Hex {
  return concat([data ?? "0x", TAG]);
}

/** Send a raw tx (e.g. Textile's prepared approval/swap) with the tag appended. */
export async function sendTagged(tx: { to: Address; data?: Hex; value?: bigint }): Promise<Hex> {
  const hash = await walletClient.sendTransaction({
    account,
    chain: celo,
    to: tx.to,
    data: withTag(tx.data),
    value: tx.value ?? 0n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Tx reverted: ${hash}`);
  return hash;
}

/** Call a contract function with the tag appended to the encoded calldata. */
export async function writeTagged(args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<Hex> {
  const data = encodeFunctionData({ abi: args.abi, functionName: args.functionName, args: args.args ?? [] } as any);
  return sendTagged({ to: args.address, data });
}
