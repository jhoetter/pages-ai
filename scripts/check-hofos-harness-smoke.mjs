#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(ROOT, "hofos-ui.config.json"), "utf8"));

function fail(message) {
  console.error(`hofos-harness-smoke: ${message}`);
  process.exitCode = 1;
}

if (config.harness.requiredProxyPrefix !== "/api/pages") {
  fail("expected /api/pages proxy prefix");
}

if (!/Office-AI/.test(config.harness.officeAiAttachmentContract)) {
  fail("missing Office-AI attachment contract");
}

const app = readFileSync(join(ROOT, "packages/web/src/App.tsx"), "utf8");
const pageEditor = readFileSync(join(ROOT, "packages/web/src/pages/PageEditor.tsx"), "utf8");
if (!app.includes("/pages/templates") || !app.includes("/pages/settings")) {
  fail("App must link templates and settings routes");
}
const palette = app + pageEditor;
if (
  !palette.includes("CommandPalette") ||
  !pageEditor.includes("metaKey") ||
  !pageEditor.includes("ctrlKey")
) {
  fail("Cmd+K palette coverage required");
}

if (
  !existsSync(join(ROOT, "release-out/hofos-ui/pagesai-ui-source/hofos-ui-export-manifest.json"))
) {
  console.warn(
    "hofos-harness-smoke warning: export manifest not present; run pnpm run export:hofos-ui before release.",
  );
}

if (process.exitCode) process.exit(process.exitCode);
console.log("hofos-harness-smoke: ok (pagesai)");
