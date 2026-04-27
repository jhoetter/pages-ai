#!/usr/bin/env node
/**
 * Wait until host:port accepts TCP (e.g. Postgres after `docker compose up -d`).
 * Usage: node scripts/wait-tcp.mjs 5433 [host]
 */
import net from "node:net";

const port = Number(process.argv[2] ?? 5433);
const host = process.argv[3] ?? "127.0.0.1";
const maxAttempts = 90;
const delayMs = 2000;

function tryConnect() {
  return new Promise((resolve) => {
    const s = net.connect({ host, port }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

for (let i = 0; i < maxAttempts; i++) {
  if (await tryConnect()) {
    console.error(`wait-tcp: ${host}:${port} ready`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, delayMs));
}
console.error(`wait-tcp: timeout waiting for ${host}:${port}`);
process.exit(1);
