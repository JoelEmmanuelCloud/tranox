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
  type PrivateKeyAccount,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { env } from "./config.js";

export const publicClient = createPublicClient({ chain: celo, transport: http(env.rpcUrl) });

let signer: { account: PrivateKeyAccount; walletClient: WalletClient } | undefined;

function getSigner() {
  if (!signer) {
    const account = privateKeyToAccount(env.privateKey());
    signer = { account, walletClient: createWalletClient({ account, chain: celo, transport: http(env.rpcUrl) }) };
  }
  return signer;
}

export function agent(): PrivateKeyAccount {
  return getSigner().account;
}

export function withTag(data: Hex | undefined): Hex {
  return concat([data ?? "0x", toDataSuffix(env.tag()) as Hex]);
}

export async function sendTagged(tx: { to: Address; data?: Hex; value?: bigint }): Promise<Hex> {
  const { account, walletClient } = getSigner();
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

export async function writeTagged(args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<Hex> {
  const data = encodeFunctionData({ abi: args.abi, functionName: args.functionName, args: args.args ?? [] } as any);
  return sendTagged({ to: args.address, data });
}
