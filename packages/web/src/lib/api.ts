import { runtimeApiBase, runtimeAuthHeaders } from "./runtime-config";

export async function apiGet<T>(path: string): Promise<T> {
  const base = runtimeApiBase().replace(/\/$/, "");
  const headers = await runtimeAuthHeaders();
  const res = await fetch(`${base}${path}`, { headers: { ...headers } });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = runtimeApiBase().replace(/\/$/, "");
  const headers = await runtimeAuthHeaders();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
