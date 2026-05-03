import { useEffect, useState } from "react";
import {
  HOF_SHELL_SIDEBAR_CHANGED_EVENT,
  HOF_SHELL_SIDEBAR_DEFAULT_WIDTH,
  HOF_SHELL_SIDEBAR_MIN_WIDTH,
  HOF_SHELL_STORAGE_KEYS,
  isSidebarStorageKey,
  persistSidebarState,
  readShellStorage,
  readSidebarCollapsed,
} from "@hofos/shell-ui";

/** Restore the Hof shell sidebar after desktop collapse (same persistence as HofShellLayout). */
export function expandHofShellSidebar(): void {
  const stored = readShellStorage(
    HOF_SHELL_STORAGE_KEYS.sidebarWidth,
    HOF_SHELL_STORAGE_KEYS.legacySidebarWidth,
  );
  const parsed = stored ? Number(stored) : NaN;
  const width =
    Number.isFinite(parsed) && parsed >= HOF_SHELL_SIDEBAR_MIN_WIDTH
      ? parsed
      : HOF_SHELL_SIDEBAR_DEFAULT_WIDTH;
  persistSidebarState(width, false);
}

export function useHofShellSidebarCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    const sync = () => setCollapsed(readSidebarCollapsed());
    window.addEventListener(HOF_SHELL_SIDEBAR_CHANGED_EVENT, sync);
    const onStorage = (event: StorageEvent) => {
      if (isSidebarStorageKey(event.key)) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(HOF_SHELL_SIDEBAR_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return collapsed;
}
