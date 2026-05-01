import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  HofShellLayout,
  HOF_SHELL_APP_LINKS,
  fetchHofShellUser,
  type HofShellUser,
  type HofShellNavGroup,
} from "@hofos/shell-ui";
import { useTranslation } from "react-i18next";
import { PageTree } from "@/components/PageTree";

const hofos = import.meta.env["VITE_HOFOS_MODE"] === "1";

export function WorkspaceShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shellUser, setShellUser] = useState<HofShellUser | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchHofShellUser({ endpoint: "/api/me", fallbackName: "Pages" }).then((user) => {
      if (alive) setShellUser(user);
    });
    return () => {
      alive = false;
    };
  }, []);

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
          { id: "templates", label: t("nav.templates"), path: "/pages/templates", icon: "file-text" },
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
      appLinks={HOF_SHELL_APP_LINKS.map((link) =>
        link.id === "pagesai" ? { ...link, href: "/pages" } : link,
      )}
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
      {paletteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border shadow-lg p-2"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-border)",
              color: "var(--color-foreground)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-3 py-2 text-xs text-[var(--color-tertiary)] border-b" style={{ borderColor: "var(--color-border)" }}>
              Actions
            </p>
            {HOF_SHELL_APP_LINKS.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  window.location.href = app.href;
                  setPaletteOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--color-hover)]"
              >
                Open {app.label}
              </button>
            ))}
            <Link to="/pages" className="block rounded-md px-3 py-2 text-sm hover:bg-[var(--color-hover)]" onClick={() => setPaletteOpen(false)}>
              Open Pages
            </Link>
          </div>
        </div>
      ) : null}
    </HofShellLayout>
  );
}
