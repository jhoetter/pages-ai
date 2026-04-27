#!/usr/bin/env node
/**
 * Free TCP listen ports (SIGKILL PIDs from lsof). macOS/Linux for local e2e.
 * Usage: node scripts/kill-ports.mjs 3399 3400
 */
import { execSync } from "node:child_process";

if (process.platform === "win32") {
  console.error("kill-ports: skipped on Windows");
  process.exit(0);
}

for (const port of process.argv.slice(2)) {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    for (const pid of out.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
        console.error(`kill-ports: freed ${port} (pid ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no listener */
  }
}
