import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Monorepo root (pages-ai/) */
const rootDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** Clear stale API/UI from failed runs so Vite strictPort can bind. */
const composeUpAndDev = [
  "node scripts/kill-ports.mjs 3399 3400",
  "docker compose -f infra/docker/docker-compose.yml up -d",
  "node scripts/wait-tcp.mjs 5433",
  "pnpm dev",
].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3400" },
  /**
   * Bring up infra, wait for Postgres :5433, then `turbo dev` (API :3399, web :3400).
   * Set `CI=1` or run `make dev` yourself and tests will reuse the server when not in CI.
   */
  webServer: {
    command: composeUpAndDev,
    cwd: rootDir,
    url: "http://127.0.0.1:3400",
    reuseExistingServer: !process.env["CI"],
    timeout: 240_000,
  },
});
