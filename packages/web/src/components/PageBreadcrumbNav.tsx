import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export type PageBreadcrumbItem = { label: string; to?: string };

/**
 * Shared breadcrumb row (same typography as the page editor chrome): muted links + “/” separators;
 * the last segment is the current page (plain text, no link).
 */
export function PageBreadcrumbNav(props: { items: PageBreadcrumbItem[] }) {
  const { t } = useTranslation();
  const items = props.items;
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("shell.pageBreadcrumb")}
      className="flex min-w-0 flex-1 flex-wrap items-center gap-y-1"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${i}-${item.label}`} className="flex min-w-0 shrink items-center">
            {isLast ? (
              <span className="min-w-0 truncate text-[13px] font-medium text-[var(--pa-fg)]">
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  to={item.to!}
                  className="truncate text-[13px] font-medium text-[var(--pa-fg)] opacity-40 no-underline transition-opacity hover:opacity-75"
                >
                  {item.label}
                </Link>
                <span
                  className="mx-1.5 shrink-0 select-none text-[13px] text-[var(--pa-fg)] opacity-20"
                  aria-hidden
                >
                  /
                </span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
