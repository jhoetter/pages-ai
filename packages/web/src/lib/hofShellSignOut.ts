/**
 * Mirrors `@hofos/shell-ui` `signOutOfHofShell` for older published builds that omit this export.
 * Remove once `@hofos/shell-ui` dependency includes `signOutOfHofShell` in dist.
 */
export interface HofShellSignOutOptions {
  redirectTo?: string | null;
  reload?: boolean;
  extraStorageKeys?: readonly string[];
}

export function signOutOfHofShell({
  redirectTo = "/",
  reload = false,
  extraStorageKeys = [],
}: HofShellSignOutOptions = {}): void {
  if (typeof window === "undefined") return;
  for (const key of ["hof_token", "mailai.token", ...extraStorageKeys]) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be disabled; cookie cleanup and navigation still apply.
    }
  }
  for (const key of ["hof_subapp_session", "hof_token"]) {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
  }
  if (redirectTo !== null) {
    window.location.href = redirectTo;
  } else if (reload) {
    window.location.reload();
  }
}
