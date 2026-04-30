import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { apiGet } from "@/lib/api";

type SearchRes = { results: Array<{ id: string; title: string }> };
const GLOBAL_APP_LINKS = [
  { id: "os", label: "App", href: "http://localhost:3000/" },
  { id: "hofos", label: "hofOS", href: "http://localhost:3600/customers" },
  { id: "mailai", label: "Mail", href: "http://localhost:3010/inbox" },
  { id: "collabai", label: "Chat", href: "http://localhost:8010/" },
  { id: "driveai", label: "Drive", href: "http://localhost:3520/drive/home" },
  { id: "pagesai", label: "Pages", href: "http://localhost:3399/pages" },
] as const;

export function CommandPalette(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spaceId: string;
  pageId?: string;
  onOpenComments: () => void;
  onCreatePage: () => void;
  onToggleTheme: () => void;
  onToggleLang: () => void;
}) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!props.open) setSearch("");
  }, [props.open]);

  const q = search.trim();
  const { data: searchData, isFetched } = useQuery({
    queryKey: ["cmd-search", q],
    enabled: props.open && q.length > 0,
    queryFn: () => apiGet<SearchRes>(`/api/search?q=${encodeURIComponent(q)}`),
  });

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
      data-testid="command-palette"
      onClick={() => props.onOpenChange(false)}
    >
      <Command
        className="w-full max-w-lg rounded-lg border shadow-lg"
        style={{
          background: "var(--pa-surface)",
          borderColor: "var(--pa-divider)",
          color: "var(--pa-fg)",
        }}
        onClick={(e) => e.stopPropagation()}
        shouldFilter={false}
      >
        <Command.Input
          placeholder={t("palette.search")}
          value={search}
          onValueChange={setSearch}
          autoFocus
          className="w-full px-3 py-2.5 outline-none bg-transparent text-[15px] border-b"
          style={{ borderColor: "var(--pa-divider)" }}
        />
        <p
          className="px-3 py-2 text-xs text-[var(--pa-tertiary)] border-b"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          {q.length === 0 ? t("palette.cmdkHint") : t("palette.searchAsYouType")}
        </p>
        <Command.List className="max-h-72 overflow-auto py-1">
          {q.length > 0 && isFetched && (searchData?.results?.length ?? 0) === 0 ? (
            <div className="px-3 py-4 text-sm text-[var(--pa-tertiary)] text-center">
              {t("palette.noSearchResults")}
            </div>
          ) : null}
          {q.length > 0 && (searchData?.results?.length ?? 0) > 0 ? (
            <Command.Group heading={t("palette.searchResults")}>
              {(searchData?.results ?? []).map((r) => (
                <Command.Item
                  key={r.id}
                  onSelect={() => {
                    nav(`/pages/p/${r.id}`);
                    props.onOpenChange(false);
                  }}
                  className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
                >
                  {r.title}
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          <Command.Group heading={t("palette.quickActions")} className="px-1">
            <Command.Item
              onSelect={() => {
                nav(`/pages?q=${encodeURIComponent(q)}`);
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("palette.searchPages")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                props.onCreatePage();
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("palette.newPage")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                props.onOpenComments();
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("palette.comments")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                props.onToggleTheme();
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("palette.theme")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                void i18n.changeLanguage(i18n.language === "de" ? "en" : "de");
                props.onToggleLang();
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("palette.lang")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                nav(`/pages/db/example-db`);
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("db.title")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                nav(`/pages/templates`);
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("nav.templates")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                nav(`/pages/settings`);
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("nav.settings")}
            </Command.Item>
            <Command.Item
              onSelect={() => {
                nav(`/pages/space/${props.spaceId}`);
                props.onOpenChange(false);
              }}
              className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
            >
              {t("nav.pages")}
            </Command.Item>
            {GLOBAL_APP_LINKS.map((app) => (
              <Command.Item
                key={app.id}
                onSelect={() => {
                  window.location.href = app.href;
                  props.onOpenChange(false);
                }}
                className="px-3 py-2 rounded-md mx-1 cursor-pointer aria-selected:bg-[var(--pa-hover)]"
              >
                Open {app.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
