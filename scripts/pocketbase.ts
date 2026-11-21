import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "pocketbase");
const bin = join(root, "bin", process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
if (!existsSync(bin)) {
  console.error(`PocketBase not found at ${bin}. Download v0.40.6 for your OS from https://github.com/pocketbase/pocketbase/releases and unzip it there.`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) args.push("serve", "--http", "127.0.0.1:8090");
const dirs = ["--dir", join(root, "pb_data"), "--migrationsDir", join(root, "pb_migrations"), "--hooksDir", join(root, "pb_hooks")];

const usesDirs = ["serve", "migrate", "superuser"].includes(args[0]);
const child = spawn(bin, usesDirs ? [...args, ...dirs] : args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
