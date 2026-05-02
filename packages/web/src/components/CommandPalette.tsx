import { useQuery } from "@tanstack/react-query";
import {
  CommandPalette as HofCommandPalette,
  createAppLinkCommands,
  type CommandItem,
} from "@hofos/ux";
import { HOF_SHELL_APP_LINKS } from "@hofos/shell-ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { apiGet } from "@/lib/api";

type SearchRes = { results: Array<{ id: string; title: string }> };

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

  const commands: CommandItem[] = [
    ...(q.length > 0
      ? (searchData?.results ?? []).map((result) => ({
          id: `page:${result.id}`,
          group: t("palette.searchResults"),
          label: result.title,
          perform: () => nav(`/pages/p/${result.id}`),
        }))
      : []),
    {
      id: "pages:search",
      group: t("palette.quickActions"),
      label: t("palette.searchPages"),
      perform: () => nav(`/pages?q=${encodeURIComponent(q)}`),
    },
    {
      id: "pages:create",
      group: t("palette.quickActions"),
      label: t("palette.newPage"),
      perform: props.onCreatePage,
    },
    {
      id: "pages:comments",
      group: t("palette.quickActions"),
      label: t("palette.comments"),
      perform: props.onOpenComments,
    },
    {
      id: "pages:theme",
      group: t("palette.quickActions"),
      label: t("palette.theme"),
      perform: props.onToggleTheme,
    },
    {
      id: "pages:language",
      group: t("palette.quickActions"),
      label: t("palette.lang"),
      perform: () => {
        void i18n.changeLanguage(i18n.language === "de" ? "en" : "de");
        props.onToggleLang();
      },
    },
    {
      id: "pages:database",
      group: t("palette.quickActions"),
      label: t("db.title"),
      perform: () => nav("/pages/db/example-db"),
    },
    {
      id: "pages:templates",
      group: t("palette.quickActions"),
      label: t("nav.templates"),
      perform: () => nav("/pages/templates"),
    },
    {
      id: "pages:settings",
      group: t("palette.quickActions"),
      label: t("nav.settings"),
      perform: () => nav("/pages/settings"),
    },
    {
      id: "pages:home",
      group: t("palette.quickActions"),
      label: t("nav.pages"),
      perform: () => nav(`/pages/space/${props.spaceId}`),
    },
    ...createAppLinkCommands(
      HOF_SHELL_APP_LINKS.map((link) =>
        link.id === "pagesai" ? { ...link, href: "/pages" } : link,
      ),
    ),
  ];

  const noSearchResults = q.length > 0 && isFetched && (searchData?.results?.length ?? 0) === 0;

  return (
    <HofCommandPalette
      open={props.open}
      onOpenChange={props.onOpenChange}
      commands={commands}
      placeholder={t("palette.search")}
      inputValue={search}
      onInputValueChange={setSearch}
      shouldFilter={false}
      hint={
        noSearchResults
          ? t("palette.noSearchResults")
          : q.length === 0
            ? t("palette.cmdkHint")
            : t("palette.searchAsYouType")
      }
    />
  );
}
