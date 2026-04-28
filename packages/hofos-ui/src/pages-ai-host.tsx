import { I18nextProvider } from "react-i18next";
import "../../web/src/index.css";
import { App } from "../../web/src/App";
import i18n from "../../web/src/i18n";
import { setRuntimeConfig } from "../../web/src/lib/runtime-config";

export interface PagesAiHostProps {
  apiBase?: string;
  wsBase?: string;
  getAuthToken?: () => Promise<string>;
}

export interface PagesAiRouteDefinition {
  path: string;
}

export const product = "pagesai" as const;

export const pagesAiRoutes: PagesAiRouteDefinition[] = [
  { path: "/pages" },
  { path: "/pages/p/:pageId" },
  { path: "/pages/p/:pageId?block=:blockId" },
  { path: "/pages/space/:spaceId" },
  { path: "/pages/db/:databaseId" },
  { path: "/pages/db/:databaseId?view=:viewId" },
  { path: "/pages/templates" },
  { path: "/pages/settings" },
];

export function PagesAiHost({ apiBase = "/api/pages", wsBase = "/api/pages", getAuthToken }: PagesAiHostProps) {
  setRuntimeConfig({
    apiBase,
    wsBase,
    getAuthToken: getAuthToken ?? (async () => ""),
  });

  return (
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  );
}
