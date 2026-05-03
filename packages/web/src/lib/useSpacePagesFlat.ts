import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

/** GET `/api/pages` / `page.list` payload shape (Fastify + Drizzle). */
type PagesListPayload = {
  operations?: Array<{ payload?: { pages?: Array<{ id: string; title?: string | null }> } }>;
};

export type SpacePagesFlatRow = { id: string; title: string };

export function normalizePagesFlatResponse(data: PagesListPayload | undefined): SpacePagesFlatRow[] {
  const raw = data?.operations?.[0]?.payload?.pages ?? [];
  return raw.map((p) => {
    const id = String(p.id);
    const rawTitle = p.title;
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    return { id, title };
  });
}

export function useSpacePagesFlat(spaceId: string | undefined, options?: { enabled?: boolean }) {
  const extraEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ["pages-flat", spaceId] as const,
    enabled: Boolean(spaceId) && extraEnabled,
    queryFn: () =>
      apiGet<PagesListPayload>(
        `/api/pages?space_id=${encodeURIComponent(spaceId!)}&all_in_space=1`,
      ),
    select: normalizePagesFlatResponse,
  });
}
