import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 3400,
    strictPort: true,
    /** Playwright and API calls use 127.0.0.1; default `localhost` can be IPv6-only on some hosts. */
    host: "127.0.0.1",
  },
  preview: {
    port: 3400,
    strictPort: true,
  },
});
