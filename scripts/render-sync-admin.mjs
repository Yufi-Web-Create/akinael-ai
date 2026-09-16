import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminDir = resolve(root, "admin");
const adminDist = resolve(adminDir, "dist");
const publicAdmin = resolve(root, "public", "admin");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(npmCommand, ["install", "--include=dev", "--no-audit", "--no-fund"], {
  cwd: adminDir,
  stdio: "inherit"
});
execFileSync(npmCommand, ["run", "build"], { cwd: adminDir, stdio: "inherit" });

rmSync(publicAdmin, { recursive: true, force: true });
mkdirSync(resolve(root, "public"), { recursive: true });
cpSync(adminDist, publicAdmin, { recursive: true });

console.log("[render-sync-admin] admin/dist -> public/admin synced");
