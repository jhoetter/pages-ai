import { createContext, useContext, type MutableRefObject } from "react";

export type PageBodySurfaceValue = {
  pageId: string;
  spaceId?: string;
  excludePageId: string;
  onCreateDatabase: () => Promise<string>;
  /** When true, debounced `page.body_sync` flush is skipped (e.g. in-flight file upload with no asset yet). */
  bodySyncSuspendedRef: MutableRefObject<boolean>;
  /** Set by `PageBodyCommandsPlugin` — call after structural replaces (slash menu) so `page.body_sync` is not delayed on OnChange alone. */
  flushBodySyncRef: MutableRefObject<(() => void) | null>;
};

export const PageBodySurfaceContext = createContext<PageBodySurfaceValue | null>(null);

export function usePageBodySurface(): PageBodySurfaceValue {
  const v = useContext(PageBodySurfaceContext);
  if (!v) throw new Error("PageBodySurfaceContext missing");
  return v;
}
