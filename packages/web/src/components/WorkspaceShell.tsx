import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  HofShellLayout,
  HOF_SHELL_APP_LINKS,
  fetchHofShellUser,
  type HofShellUser,
  type HofShellNavGroup,
} from "@hofos/shell-ui";
import { useTranslation } from "react-i18next";
import { CommandPalette as HofCommandPalette, createAppLinkCommands, useShortcut } from "@hofos/ux";
import { PageTree } from "@/components/PageTree";

const hofos = import.meta.env["VITE_HOFOS_MODE"] === "1";

export function WorkspaceShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shellUser, setShellUser] = useState<HofShellUser | null>(null);

  const shortcutBindings = useMemo(
    () => [
      {
        key: "k",
        meta: true,
        description: "Open command palette",
        run: () => setPaletteOpen((open) => !open),
      },
      {
        key: "Escape",
        allowInTypingTarget: true,
        description: "Close command palette",
        run: () => setPaletteOpen(false),
      },
    ],
    [],
  );
  useShortcut(shortcutBindings);

  useEffect(() => {
    let alive = true;
    void fetchHofShellUser({ endpoint: "/api/me", fallbackName: "Pages" }).then((user) => {
      if (alive) setShellUser(user);
    });
    return () => {
      alive = false;
    };
  }, []);

  const appLinks = useMemo(
    () =>
      HOF_SHELL_APP_LINKS.map((link) =>
        link.id === "pagesai" ? { ...link, href: "/pages" } : link,
      ),
    [],
  );

  const paletteCommands = useMemo(
    () => [
      ...createAppLinkCommands(appLinks),
      {
        id: "pages:home",
        group: "Actions",
        label: "Open Pages",
        perform: () => navigate("/pages"),
      },
    ],
    [appLinks, navigate],
  );

  const navGroups = useMemo<HofShellNavGroup[]>(
    () => [
      {
        id: "pages",
        label: "Pages",
        items: [
          {
            id: "page-tree",
            label: "Pages",
            content: <PageTree />,
          },
        ],
      },
      {
        id: "workspace",
        label: "Workspace",
        items: [
          {
            id: "templates",
            label: t("nav.templates"),
            path: "/pages/templates",
            icon: "file-text",
          },
          { id: "settings", label: t("nav.settings"), path: "/pages/settings", icon: "settings" },
        ],
      },
    ],
    [t],
  );

  if (hofos) {
    return <Outlet />;
  }

  return (
    <HofShellLayout
      appId="pagesai"
      appLabel="Pages"
      appIcon="file-text"
      currentPath={location.pathname}
      primaryNavGroups={navGroups}
      appLinks={appLinks}
      user={shellUser}
      onCommand={() => setPaletteOpen(true)}
      onNavigate={(path) => {
        if (path.startsWith("/")) navigate(path);
        else window.location.href = path;
      }}
    >
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <Outlet />
      </div>
      <HofCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={paletteCommands}
        placeholder="Search or run a command..."
        hint="Actions"
      />
    </HofShellLayout>
  );
}
