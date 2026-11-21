import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { toDataSuffix } from "@celo/attribution-tags";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../src/config.js";

const root = join(import.meta.dirname, "..", "pocketbase");
const bin = join(root, "bin", process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
if (!existsSync(bin)) {
  console.error(`PocketBase not found at ${bin}. Download v0.40.6 for your OS from https://github.com/pocketbase/pocketbase/releases and unzip it there.`);
  process.exit(1);
}

function payPageEnv(): Record<string, string> {
  try {
    return {
      TRANOX_AGENT_WALLET: privateKeyToAccount(env.privateKey()).address,
      TRANOX_DATA_SUFFIX: toDataSuffix(env.tag()),
    };
  } catch (e) {
    console.error(`Payment page disabled until AGENT_PRIVATE_KEY and CELO_ATTRIBUTION_TAG are set in .env: ${e instanceof Error ? e.message : e}`);
    return {};
  }
}

const args = process.argv.slice(2);
if (args.length === 0) args.push("serve", "--http", "127.0.0.1:8090");
const dirs = ["--dir", join(root, "pb_data"), "--migrationsDir", join(root, "pb_migrations"), "--hooksDir", join(root, "pb_hooks")];
if (args[0] === "serve") dirs.push("--publicDir", join(root, "pb_public"));

const usesDirs = ["serve", "migrate", "superuser"].includes(args[0]);
const childEnv = args[0] === "serve" ? { ...process.env, ...payPageEnv() } : process.env;
const child = spawn(bin, usesDirs ? [...args, ...dirs] : args, { stdio: "inherit", env: childEnv });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
