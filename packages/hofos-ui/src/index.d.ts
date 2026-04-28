import type { ComponentType } from "react";

export interface PagesAiHostProps {
  apiBase?: string;
  wsBase?: string;
  getAuthToken?: () => Promise<string>;
}
export interface PagesAiRouteDefinition {
  path: string;
}
export declare const product: "pagesai";
export declare const routes: PagesAiRouteDefinition[];
export declare const pagesAiRoutes: PagesAiRouteDefinition[];
export declare const PagesAiHost: ComponentType<PagesAiHostProps>;
export { PagesAiHost as Host };
