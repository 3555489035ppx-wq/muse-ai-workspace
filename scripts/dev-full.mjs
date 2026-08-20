import { spawn } from "node:child_process";
import { join } from "node:path";

const tsxEntry = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const viteEntry = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const children = new Set();
let stopping = false;
let restartTimer;
let bffRestartAttempt = 0;

const commands = {
  bff: { command: process.execPath, args: [tsxEntry, "watch", "server/server.ts"] },
  frontend: { command: process.execPath, args: [viteEntry] },
};

function start(name) {
  const target = commands[name];
  const child = spawn(target.command, target.args, { stdio: "inherit", shell: false, windowsHide: true });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    if (name === "frontend") {
      shutdown(code ?? 1);
      return;
    }
    if (code === 0 && !signal) {
      bffRestartAttempt = 0;
      return;
    }
    bffRestartAttempt += 1;
    const delay = Math.min(5000, 500 * bffRestartAttempt);
    process.stderr.write(`Muse AI BFF exited; restarting in ${String(delay)}ms.\n`);
    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      if (!stopping) start("bff");
    }, delay);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping && code === 0) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  for (const child of children) child.kill();
  if (code !== 0) process.exitCode = code;
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
start("bff");
start("frontend");
