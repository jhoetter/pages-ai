export type { AssetRef, PagesAiHostCapabilities } from "@pagesai/core";

export function createStandaloneFileHost(): import("@pagesai/core").PagesAiHostCapabilities {
  return {
    async openAsset(ref) {
      const w = globalThis as Window & typeof globalThis;
      if (ref.url && typeof w.open === "function") w.open(ref.url, "_blank", "noopener");
    },
  };
}
