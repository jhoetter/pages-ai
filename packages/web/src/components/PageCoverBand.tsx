import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";

type PageCoverBandProps = {
  show: boolean;
  coverDraft: string;
  onDraftChange: (url: string) => void;
  onCommit: (url: string | null) => void;
  t: TFunction;
};

export function PageCoverBand(props: PageCoverBandProps) {
  const { show, coverDraft, onDraftChange, onCommit, t } = props;
  const [hover, setHover] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(coverDraft);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) setUrlInput(coverDraft);
  }, [coverDraft, popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (el && !el.contains(e.target as Node)) setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popoverOpen]);

  if (!show) return null;

  const hasCover = Boolean(coverDraft.trim());

  const openEditor = () => {
    setUrlInput(coverDraft);
    setPopoverOpen(true);
  };

  const saveUrl = () => {
    const next = urlInput.trim();
    onDraftChange(next);
    void onCommit(next || null);
    setPopoverOpen(false);
  };

  const removeCover = () => {
    onDraftChange("");
    void onCommit(null);
    setPopoverOpen(false);
  };

  const radius = "var(--pa-radius-md)";
  const ring = hover ? "0 0 0 1px var(--pa-divider)" : "0 0 0 1px transparent";

  return (
    <div
      className="relative -mx-8 mb-8 h-44 overflow-hidden transition-[box-shadow] duration-150"
      style={{
        borderRadius: radius,
        boxShadow: ring,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hasCover ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverDraft.trim()})` }}
          role="img"
          aria-label={t("canvas.cover.aria")}
        />
      ) : (
        /* Flat placeholder: no gradient — host DS can retone via --pa-bg / --pa-surface */
        <div className="absolute inset-0" style={{ background: "var(--pa-bg)" }} />
      )}

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-2 px-3 py-2 border-t transition-opacity duration-150 ${
          hover || popoverOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          background: "var(--pa-surface)",
          borderColor: "var(--pa-divider)",
        }}
      >
        <div className="flex flex-wrap gap-2 justify-end">
          {hasCover ? (
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
              style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
              onClick={openEditor}
            >
              {t("canvas.cover.change")}
            </button>
          ) : (
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
              style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
              onClick={openEditor}
            >
              {t("canvas.cover.add")}
            </button>
          )}
          {hasCover ? (
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
              style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
              onClick={removeCover}
            >
              {t("canvas.cover.remove")}
            </button>
          ) : null}
        </div>
      </div>

      {popoverOpen ? (
        <div
          ref={popoverRef}
          className="absolute left-1/2 top-1/2 z-10 w-[min(100%-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 border p-3"
          style={{
            borderRadius: "var(--pa-radius-md)",
            background: "var(--pa-surface)",
            borderColor: "var(--pa-divider)",
            boxShadow: "var(--pa-popover-shadow)",
          }}
        >
          <label className="block text-xs text-[var(--pa-tertiary)] mb-1">{t("canvas.coverUrl")}</label>
          <input
            type="url"
            className="w-full text-sm border px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--pa-accent)]/30"
            style={{
              borderRadius: "var(--pa-radius-sm)",
              borderColor: "var(--pa-divider)",
              background: "var(--pa-bg)",
            }}
            value={urlInput}
            placeholder={t("canvas.cover.placeholder")}
            autoFocus
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveUrl();
              }
              if (e.key === "Escape") setPopoverOpen(false);
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)]"
              style={{ borderRadius: "var(--pa-radius-sm)" }}
              onClick={() => setPopoverOpen(false)}
            >
              {t("canvas.cover.cancel")}
            </button>
            <button
              type="button"
              className="text-xs px-2.5 py-1 font-medium text-white bg-[var(--pa-accent)] hover:opacity-90"
              style={{ borderRadius: "var(--pa-radius-sm)" }}
              onClick={saveUrl}
            >
              {t("canvas.cover.save")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
