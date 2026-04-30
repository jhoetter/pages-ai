import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import { PageTree } from "@/components/PageTree";

const hofos = import.meta.env["VITE_HOFOS_MODE"] === "1";
const HOF_SHELL_SIDEBAR_DEFAULT_WIDTH = 240;
const HOF_SHELL_STORAGE_KEYS = {
  sidebarWidth: "hof-shell-sidebar-width",
  legacySidebarWidth: "hof-sidebar-width",
} as const;

const GLOBAL_APP_LINKS = [
  { id: "os", label: "App", href: "http://localhost:3000/", icon: "home" },
  { id: "hofos", label: "hofOS", href: "http://localhost:3600/customers", icon: "briefcase" },
  { id: "mailai", label: "Mail", href: "http://localhost:3010/inbox", icon: "mail" },
  { id: "collabai", label: "Chat", href: "http://localhost:8010/", icon: "chat" },
  { id: "driveai", label: "Drive", href: "http://localhost:3520/drive/home", icon: "folder" },
  { id: "pagesai", label: "Pages", href: "http://localhost:3399/pages", icon: "file" },
] as const;

function ShellIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0">
      {name === "home" ? <path {...common} d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> : null}
      {name === "briefcase" ? <path {...common} d="M10 7V5h4v2m-9 3h14m-16 0h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" /> : null}
      {name === "mail" ? <path {...common} d="M4 6h16v12H4zm0 2 8 6 8-6" /> : null}
      {name === "chat" ? <path {...common} d="M5 6h14v10H8l-4 4V7a1 1 0 0 1 1-1z" /> : null}
      {name === "folder" ? <path {...common} d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> : null}
      {name === "file" ? <path {...common} d="M7 3h7l4 4v14H7zm7 0v5h4" /> : null}
    </svg>
  );
}

function readSidebarWidth(): number {
  try {
    const raw =
      localStorage.getItem(HOF_SHELL_STORAGE_KEYS.sidebarWidth) ??
      localStorage.getItem(HOF_SHELL_STORAGE_KEYS.legacySidebarWidth);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value >= 140 && value <= 480
      ? value
      : HOF_SHELL_SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return HOF_SHELL_SIDEBAR_DEFAULT_WIDTH;
  }
}

export function WorkspaceShell() {
  const { t } = useTranslation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sidebarWidth = readSidebarWidth();
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
  if (hofos) {
    return <Outlet />;
  }
  return (
    <div className="flex h-full min-h-0" style={{ background: "var(--pa-bg)" }}>
      <aside
        className="shrink-0 flex flex-col border-r text-sm transition-colors duration-150"
        style={{
          width: sidebarWidth,
          borderColor: "var(--pa-divider)",
          background: "var(--pa-surface)",
        }}
        data-testid="workspace-sidebar"
      >
        <div
          className="px-3 py-3 border-b tracking-tight flex flex-col gap-2"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          <Link
            to="/pages"
            className="text-[var(--pa-fg)] font-semibold text-[15px] no-underline hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            <ShellIcon name="file" />
            <span>Pages</span>
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)]"
            style={{ borderColor: "var(--pa-divider)" }}
          >
            <span>Actions</span>
            <span className="text-[10px]">⌘K</span>
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <PageTree />
          <div
            className="p-2 border-t flex flex-col gap-0.5 text-[var(--pa-secondary)]"
            style={{ borderColor: "var(--pa-divider)" }}
          >
            <Link
              to="/pages/templates"
              className="px-2 py-1.5 rounded-md text-[13px] hover:bg-[var(--pa-hover)] no-underline transition-colors"
            >
              {t("nav.templates")}
            </Link>
            <Link
              to="/pages/settings"
              className="px-2 py-1.5 rounded-md text-[13px] hover:bg-[var(--pa-hover)] no-underline transition-colors"
            >
              {t("nav.settings")}
            </Link>
          </div>
        </div>
        <div
          className="p-2 border-t flex flex-col gap-0.5 text-[var(--pa-secondary)]"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--pa-tertiary)]">
            Apps
          </div>
          {GLOBAL_APP_LINKS.map((app) => (
            <a
              key={app.id}
              href={app.href}
              className={`px-2 py-1.5 rounded-md text-[13px] no-underline transition-colors flex items-center gap-2 ${
                app.id === "pagesai" ? "bg-[var(--pa-hover)] text-[var(--pa-fg)]" : "hover:bg-[var(--pa-hover)]"
              }`}
            >
              <ShellIcon name={app.icon} />
              <span>{app.label}</span>
            </a>
          ))}
        </div>
        <div className="p-2 border-t text-[var(--pa-secondary)]" style={{ borderColor: "var(--pa-divider)" }}>
          <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--pa-hover)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pa-fg)] text-[11px] font-semibold text-[var(--pa-bg)]">
              PA
            </span>
            <span>Pages user</span>
          </div>
        </div>
      </aside>
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
              background: "var(--pa-surface)",
              borderColor: "var(--pa-divider)",
              color: "var(--pa-fg)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-3 py-2 text-xs text-[var(--pa-tertiary)] border-b" style={{ borderColor: "var(--pa-divider)" }}>
              Actions
            </p>
            {GLOBAL_APP_LINKS.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  window.location.href = app.href;
                  setPaletteOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--pa-hover)]"
              >
                Open {app.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
