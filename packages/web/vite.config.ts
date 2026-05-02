import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const DESIGN_SYSTEM_IDS = ["default", "playful", "conservative"] as const;

function resolveDesignSystemId(): (typeof DESIGN_SYSTEM_IDS)[number] {
  const raw = (process.env.VITE_DESIGN_SYSTEM ?? process.env.DESIGN_SYSTEM ?? "default")
    .trim()
    .toLowerCase();
  return (DESIGN_SYSTEM_IDS as readonly string[]).includes(raw)
    ? (raw as (typeof DESIGN_SYSTEM_IDS)[number])
    : "default";
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@pagesai-design-system.css": fileURLToPath(
        new URL(`./src/design-systems/${resolveDesignSystemId()}.css`, import.meta.url),
      ),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 3400,
    strictPort: true,
    /** Browser-facing dev URL is http://localhost:3400; API proxy targets stay on IPv4 loopback. */
    host: "localhost",
    proxy: {
      "/api": {
        target: process.env.VITE_PAGESAI_API_URL ?? "http://127.0.0.1:3399",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_PAGESAI_API_URL ?? "http://127.0.0.1:3399",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3400,
    strictPort: true,
  },
});
