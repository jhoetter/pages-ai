import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

const viteResolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  dedupe: ["lexical", "@lexical/react", "@lexical/link", "@lexical/list", "@lexical/utils", "@lexical/rich-text", "@lexical/code"],
} as const;

export default defineConfig(
  mergeConfig(
    {
      plugins: [react(), tailwindcss()],
      resolve: viteResolve,
    },
    {
      test: {
        exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
        server: {
          deps: {
            inline: ["lexical", /@lexical\//],
          },
        },
      },
    },
  ),
);
