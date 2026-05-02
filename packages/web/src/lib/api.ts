import { runtimeApiBase, runtimeAuthHeaders } from "./runtime-config";

const PAGESAI_OS_SUBAPP_PREFIX = "/__subapps/pagesai";

function hofOsBaseUrl(): string {
  const env = import.meta.env as {
    VITE_HOF_OS_PUBLIC_URL?: string;
    HOF_OS_PUBLIC_URL?: string;
  };
  const configured = (env.VITE_HOF_OS_PUBLIC_URL || env.HOF_OS_PUBLIC_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".localhost")
  ) {
    return "http://localhost:3000";
  }
  return `${window.location.protocol}//app.${window.location.hostname.replace(/^pages\./, "")}`;
}

function hofOsPagesUrl(): string {
  const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const subappPath = target.startsWith(`${PAGESAI_OS_SUBAPP_PREFIX}/`)
    ? target
    : `${PAGESAI_OS_SUBAPP_PREFIX}${target.startsWith("/") ? target : `/${target}`}`;
  return `${hofOsBaseUrl()}${subappPath}`;
}

async function throwOrRecover(res: Response): Promise<never> {
  const body = await res.text();
  if (res.status === 401 && !window.location.search.includes("__hof_handoff=")) {
    window.location.href = hofOsPagesUrl();
  }
  throw new Error(body);
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = runtimeApiBase().replace(/\/$/, "");
  const headers = await runtimeAuthHeaders();
  const res = await fetch(`${base}${path}`, { headers: { ...headers }, credentials: "include" });
  if (!res.ok) await throwOrRecover(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = runtimeApiBase().replace(/\/$/, "");
  const headers = await runtimeAuthHeaders();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwOrRecover(res);
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const base = runtimeApiBase().replace(/\/$/, "");
  const headers = await runtimeAuthHeaders();
  const fd = new FormData();
  fd.append(fieldName, file);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { ...headers },
    credentials: "include",
    body: fd,
  });
  if (!res.ok) await throwOrRecover(res);
  return res.json() as Promise<T>;
}
