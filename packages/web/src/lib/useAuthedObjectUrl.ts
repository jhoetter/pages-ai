import { useEffect, useState } from "react";
import { runtimeApiBase, runtimeAuthHeaders } from "./runtime-config";

/** Fetches a private object with API auth and exposes a temporary blob: URL. */
export function useAuthedObjectUrl(objectKey: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!objectKey) {
      setUrl(null);
      return;
    }
    let created: string | null = null;
    let cancelled = false;
    void (async () => {
      const base = runtimeApiBase().replace(/\/$/, "");
      const headers = await runtimeAuthHeaders();
      const res = await fetch(`${base}/api/assets?key=${encodeURIComponent(objectKey)}`, {
        headers: { ...headers },
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled) return;
      const u = URL.createObjectURL(blob);
      created = u;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [objectKey]);

  return url;
}
