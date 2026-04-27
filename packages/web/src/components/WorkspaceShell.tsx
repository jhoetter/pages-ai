import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { PageTree } from "@/components/PageTree";

const hofos = import.meta.env["VITE_HOFOS_MODE"] === "1";

export function WorkspaceShell() {
  const { t } = useTranslation();
  if (hofos) {
    return <Outlet />;
  }
  return (
    <div className="flex h-full min-h-0" style={{ background: "var(--pa-bg)" }}>
      <aside
        className="w-[15.5rem] shrink-0 flex flex-col border-r text-sm transition-colors duration-150"
        style={{
          borderColor: "var(--pa-divider)",
          background: "var(--pa-surface)",
        }}
        data-testid="workspace-sidebar"
      >
        <div
          className="px-3 py-3 border-b tracking-tight"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          <Link
            to="/pages"
            className="text-[var(--pa-fg)] font-semibold text-[15px] no-underline hover:opacity-80 transition-opacity"
          >
            {t("app.title")}
          </Link>
        </div>
        <PageTree />
        <div
          className="mt-auto p-2 border-t flex flex-col gap-0.5 text-[var(--pa-secondary)]"
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
      </aside>
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
