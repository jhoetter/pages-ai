export interface RuntimeConfig {
  /** Empty string = derive from VITE_PAGESAI_API_URL / hofOS */
  apiBase?: string;
  wsBase?: string;
  workspaceId?: string;
  getAuthToken(): Promise<string>;
}

let _config: RuntimeConfig | null = null;

export function setRuntimeConfig(c: RuntimeConfig | null): void {
  _config = c;
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return _config;
}

export function runtimeApiBase(): string {
  if (_config?.apiBase != null && String(_config.apiBase).length > 0) return _config.apiBase;
  if (import.meta.env["VITE_HOFOS_MODE"] === "1") return "/api/pages";
  return (import.meta.env["VITE_PAGESAI_API_URL"] as string | undefined) ?? "";
}

export function runtimeWsBase(): string {
  const api = runtimeApiBase();
  if (api.startsWith("http")) {
    const u = new URL(api);
    return `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  }
  const proto = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
  const host = globalThis.location?.host ?? "localhost:3400";
  return `${proto}//${host}${api}`;
}

export async function runtimeAuthHeaders(): Promise<Record<string, string>> {
  const t = _config ? await _config.getAuthToken() : "";
  return t ? { authorization: `Bearer ${t}` } : {};
}
