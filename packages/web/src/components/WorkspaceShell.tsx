import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  HofShellLayout,
  LucideIconByName,
  fetchHofShellUser,
  signOutOfHofShell,
  type HofShellUser,
  type HofShellNavGroup,
} from "@hofos/shell-ui";
import { useTranslation } from "react-i18next";
import { CommandPalette as HofCommandPalette, createAppLinkCommands, useShortcut } from "@hofos/ux";
import { PageTree } from "@/components/PageTree";
import { createHandoffAppLinks, navigateHandoffHref } from "@/lib/hofShellNavigation";

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
    () => createHandoffAppLinks({ selfAppId: "pagesai", selfHref: "/pages" }),
    [],
  );

  const paletteCommands = useMemo(
    () => [
      ...createAppLinkCommands(appLinks, {
        navigate: (href) => navigateHandoffHref(href),
        renderIcon: (app) => <LucideIconByName name={app.icon} size={16} />,
      }),
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
      onSignOut={() => signOutOfHofShell()}
      onCommand={() => setPaletteOpen(true)}
      onNavigate={(path) => {
        if (path.startsWith("/") && !path.startsWith("/__subapps/")) navigate(path);
        else navigateHandoffHref(path);
      }}
    >
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <Outlet />
      </div>
      <HofCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={paletteCommands}
        hint="Actions"
      />
    </HofShellLayout>
  );
}
