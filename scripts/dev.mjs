import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

await import("./stop-stale-api.mjs");

const root = resolve(import.meta.dirname, "..");
const apps = [
  { name: "api", cwd: resolve(root, "apps/api"), args: ["pnpm", "dev"] },
  { name: "web", cwd: resolve(root, "apps/web"), args: ["pnpm", "dev"] },
  { name: "renderer", cwd: resolve(root, "apps/renderer"), args: ["pnpm", "dev"] },
];

const children = new Map();
let shuttingDown = false;

for (const app of apps) {
  const child = spawn("corepack", app.args, {
    cwd: app.cwd,
    env: process.env,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(app.name, child);
  console.log(`[dev:${app.name}] starting in ${app.cwd}`);

  child.stdout.on("data", (chunk) => writePrefixed(app.name, chunk));
  child.stderr.on("data", (chunk) => writePrefixed(app.name, chunk));

  child.on("exit", (code, signal) => {
    children.delete(app.name);
    if (!shuttingDown) {
      console.error(`[dev:${app.name}] exited with ${signal ?? code}`);
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function writePrefixed(name, chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line) {
      console.log(`[dev:${name}] ${line}`);
    }
  }
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children.values()) {
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        child.kill();
      }
    } else {
      child.kill();
    }
  }

  process.exitCode = exitCode;
}
