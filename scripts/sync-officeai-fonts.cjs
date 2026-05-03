#!/usr/bin/env node
/**
 * Office-AI editors ship @font-face rules that load metric-compatible fonts
 * from `/fonts/*.woff2` (Calibri→Carlito, etc.). If those files are missing,
 * the dev server serves SPA HTML for `/fonts/...` and the browser reports
 * bogus SFNT / decode errors.
 *
 * When `packages/web/public/fonts` is already populated (e.g. committed
 * assets), this is a no-op. Otherwise tries, in order:
 *   - OFFICE_AI_FONTS_SRC
 *   - sibling checkout at ../office-ai/apps/web/public/fonts
 */

const { existsSync, copyFileSync, mkdirSync, readdirSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");

const ROOT = resolve(__dirname, "..");
const DEST = join(ROOT, "packages/web/public/fonts");

function hasBundle() {
  return existsSync(join(DEST, "carlito-400-normal.woff2"));
}

function syncFrom(src) {
  mkdirSync(DEST, { recursive: true });
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".woff2") && !name.endsWith(".txt")) continue;
    copyFileSync(join(src, name), join(DEST, name));
  }
  console.log("[officeai-fonts] Installed from", src);
}

function main() {
  if (hasBundle()) return;
  const envSrc = process.env.OFFICE_AI_FONTS_SRC;
  const sibling = resolve(ROOT, "../office-ai/apps/web/public/fonts");
  const candidates = [envSrc, sibling].filter(Boolean);
  for (const src of candidates) {
    if (existsSync(join(src, "carlito-400-normal.woff2"))) {
      syncFrom(src);
      return;
    }
  }
  console.warn(
    "[officeai-fonts] Missing packages/web/public/fonts (Carlito metric fonts). " +
      "Set OFFICE_AI_FONTS_SRC or clone ../office-ai, then re-run this script.",
  );
}

main();
