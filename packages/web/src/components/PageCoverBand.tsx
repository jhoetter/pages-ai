import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { PopoverPortal } from "@/components/PopoverPortal";
import { clampPct, formatCoverPosition, parseCoverPosition } from "@/lib/coverPosition";
import {
  EXAMPLE_COVER_COLORS_HEX,
  EXAMPLE_COVER_URLS,
  formatCoverColorToken,
  parseCoverDraft,
  tryParseHexCoverInput,
} from "@/lib/exampleCovers";

export type PageCoverBandProps = {
  show: boolean;
  coverDraft: string;
  /** Persisted CSS `background-position` (e.g. `40% 65%`); null = centered default */
  coverPosition: string | null;
  onDraftChange: (url: string) => void;
  onCommit: (url: string | null) => void;
  onCoverPositionCommit: (position: string | null) => void;
  t: TFunction;
};

export type PageCoverBandHandle = {
  /** Opens the cover gallery popover anchored to the given element (e.g. toolbar “Add cover”). */
  openGallery: (anchor: HTMLElement | null) => void;
};

export const PageCoverBand = forwardRef<PageCoverBandHandle, PageCoverBandProps>(function PageCoverBand(
  props,
  ref,
) {
  const { show, coverDraft, coverPosition, onDraftChange, onCommit, onCoverPositionCommit, t } = props;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [urlPopoverAnchor, setUrlPopoverAnchor] = useState<HTMLElement | null>(null);
  const [urlInput, setUrlInput] = useState(coverDraft);
  const [showUrlField, setShowUrlField] = useState(false);
  const [repositionMode, setRepositionMode] = useState(false);
  const [draftPos, setDraftPos] = useState({ x: 50, y: 50 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) {
      setUrlInput(coverDraft);
      setShowUrlField(false);
    }
  }, [coverDraft, popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPopoverOpen(false);
        setUrlPopoverAnchor(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popoverOpen]);

  useEffect(() => {
    if (parseCoverDraft(coverDraft.trim()).kind !== "color") return;
    setRepositionMode(false);
  }, [coverDraft]);

  useEffect(() => {
    if (!repositionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setRepositionMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [repositionMode]);

  const updatePosFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = bandRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const x = clampPct(((clientX - r.left) / r.width) * 100);
    const y = clampPct(((clientY - r.top) / r.height) * 100);
    setDraftPos({ x, y });
  }, []);

  const startReposition = () => {
    setDraftPos(parseCoverPosition(coverPosition));
    setRepositionMode(true);
  };

  const finishReposition = () => {
    const { x, y } = draftPos;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const pos = rx === 50 && ry === 50 ? null : formatCoverPosition(x, y);
    onCoverPositionCommit(pos);
    setRepositionMode(false);
  };

  const hasCover = Boolean(coverDraft.trim());

  const bgPosition = repositionMode
    ? formatCoverPosition(draftPos.x, draftPos.y)
    : coverPosition?.trim() || "50% 50%";

  if (!show) return null;

  const applyCover = (url: string) => {
    const next = url.trim();
    if (!next) return;
    setRepositionMode(false);
    onDraftChange(next);
    void onCommit(next);
    setPopoverOpen(false);
    setUrlPopoverAnchor(null);
  };

  const openGalleryAt = useCallback(
    (anchor: HTMLElement) => {
      setRepositionMode(false);
      setUrlInput(coverDraft);
      setUrlPopoverAnchor(anchor);
      setPopoverOpen(true);
    },
    [coverDraft],
  );

  useImperativeHandle(ref, () => ({
    openGallery: (anchor: HTMLElement | null) => {
      if (anchor) openGalleryAt(anchor);
    },
  }));

  const saveUrl = () => {
    const raw = urlInput.trim();
    const hexToken = tryParseHexCoverInput(raw);
    const next = hexToken ?? raw;
    setRepositionMode(false);
    onDraftChange(next);
    void onCommit(next || null);
    setPopoverOpen(false);
    setUrlPopoverAnchor(null);
  };

  const removeCover = () => {
    setRepositionMode(false);
    onDraftChange("");
    void onCommit(null);
    setPopoverOpen(false);
    setUrlPopoverAnchor(null);
  };

  const urlPopover = popoverOpen ? (
    <PopoverPortal anchor={urlPopoverAnchor} placement="top-start" gap={8}>
      <div
        ref={popoverRef}
        className="border p-3 w-[min(28rem,calc(100vw-2rem))] max-h-[min(32rem,85vh)] overflow-y-auto"
        style={{
          borderRadius: "var(--pa-radius-md)",
          background: "var(--pa-surface)",
          borderColor: "var(--pa-divider)",
          boxShadow: "var(--pa-popover-shadow)",
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--pa-tertiary)] mb-2">
          {t("canvas.cover.galleryHint")}
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {EXAMPLE_COVER_URLS.map((src) => (
            <button
              key={src}
              type="button"
              className="relative aspect-video overflow-hidden rounded-md outline-none ring-1 ring-[var(--pa-divider)] hover:ring-2 focus-visible:ring-2 focus-visible:ring-[var(--pa-accent)]"
              onClick={() => applyCover(src)}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>

        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--pa-tertiary)] mb-2">
          {t("canvas.cover.colorsHint")}
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {EXAMPLE_COVER_COLORS_HEX.map((hex) => (
            <button
              key={hex}
              type="button"
              className="relative aspect-video overflow-hidden rounded-md outline-none ring-1 ring-[var(--pa-divider)] hover:ring-2 focus-visible:ring-2 focus-visible:ring-[var(--pa-accent)]"
              style={{ backgroundColor: `#${hex}` }}
              title={`#${hex}`}
              aria-label={t("canvas.cover.colorSwatch", { hex: `#${hex}` })}
              onClick={() => applyCover(formatCoverColorToken(hex))}
            />
          ))}
        </div>

        <button
          type="button"
          className="text-xs text-[var(--pa-secondary)] hover:text-[var(--pa-fg)] mb-2"
          onClick={() => setShowUrlField((v) => !v)}
        >
          {showUrlField ? "– " : "+ "}
          {t("canvas.cover.pasteLink")}
        </button>

        {showUrlField ? (
          <>
            <label className="block text-xs text-[var(--pa-tertiary)] mb-1">{t("canvas.coverUrl")}</label>
            <input
              type="text"
              inputMode="url"
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
                if (e.key === "Escape") {
                  setPopoverOpen(false);
                  setUrlPopoverAnchor(null);
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)]"
                style={{ borderRadius: "var(--pa-radius-sm)" }}
                onClick={() => {
                  setPopoverOpen(false);
                  setUrlPopoverAnchor(null);
                }}
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
          </>
        ) : null}
      </div>
    </PopoverPortal>
  ) : null;

  if (!hasCover) {
    /* Empty-state “Add cover” lives in PageEditor’s Notion-style meta row; keep popover portal only. */
    return <>{urlPopover}</>;
  }

  const coverDisplay = parseCoverDraft(coverDraft.trim());
  const toolbarPinned = repositionMode;

  return (
    <div className="w-full">
      <div
        ref={bandRef}
        className="relative w-full overflow-hidden transition-[box-shadow,ring] duration-200 rounded-none min-h-[11rem] h-[clamp(11rem,32vh,20rem)] group/cover ring-0 ring-inset ring-transparent group-hover/cover:ring-1 group-hover/cover:ring-[var(--pa-divider)] focus-within:ring-1 focus-within:ring-[var(--pa-divider)]"
      >
        <div
          className={
            coverDisplay.kind === "color"
              ? "absolute inset-0 transition-[filter] duration-200 group-hover/cover:brightness-[0.97]"
              : "absolute inset-0 bg-cover transition-[filter] duration-200 group-hover/cover:brightness-[0.97]"
          }
          style={
            coverDisplay.kind === "color"
              ? { backgroundColor: coverDisplay.color }
              : {
                  backgroundImage: `url(${coverDisplay.url})`,
                  backgroundPosition: bgPosition,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                }
          }
          role="img"
          aria-label={
            coverDisplay.kind === "color" ? t("canvas.cover.ariaColor") : t("canvas.cover.aria")
          }
        />

        {repositionMode && coverDisplay.kind === "image" ? (
          <div
            className="absolute inset-0 z-[5] cursor-grab active:cursor-grabbing touch-none bg-[var(--pa-fg)]/[0.08]"
            role="application"
            aria-label={t("canvas.cover.repositionHint")}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              updatePosFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
              updatePosFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
            }}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-gradient-to-t from-[var(--pa-fg)]/20 to-transparent opacity-0 transition-opacity duration-200 group-hover/cover:opacity-100"
          aria-hidden
        />

        <div
          className={
            toolbarPinned
              ? "absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-[var(--pa-divider)] opacity-100 translate-y-0 pointer-events-auto"
              : "absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 px-3 py-2 border-t border-transparent transition-all duration-200 ease-out opacity-0 translate-y-1 pointer-events-none group-hover/cover:border-[var(--pa-divider)] group-hover/cover:opacity-100 group-hover/cover:translate-y-0 group-hover/cover:pointer-events-auto focus-within:border-[var(--pa-divider)] focus-within:opacity-100 focus-within:translate-y-0 focus-within:pointer-events-auto"
          }
          style={{
            background: "color-mix(in srgb, var(--pa-surface) 88%, transparent)",
          }}
        >
          {repositionMode && coverDisplay.kind === "image" ? (
            <>
              <p className="text-[11px] text-[var(--pa-secondary)] pr-2">{t("canvas.cover.repositionDrag")}</p>
              <div className="flex flex-wrap gap-2 justify-end ml-auto">
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
                  style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepositionMode(false);
                  }}
                >
                  {t("canvas.cover.repositionCancel")}
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-medium text-white bg-[var(--pa-accent)] hover:opacity-90"
                  style={{ borderRadius: "var(--pa-radius-sm)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    finishReposition();
                  }}
                >
                  {t("canvas.cover.repositionDone")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2 justify-end w-full">
              {coverDisplay.kind === "image" ? (
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
                  style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startReposition();
                  }}
                >
                  {t("canvas.cover.reposition")}
                </button>
              ) : null}
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
                style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openGalleryAt(e.currentTarget);
                }}
              >
                {t("canvas.cover.change")}
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium border hover:bg-[var(--pa-hover)]"
                style={{ borderRadius: "var(--pa-radius-sm)", borderColor: "var(--pa-divider)", color: "var(--pa-fg)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeCover();
                }}
              >
                {t("canvas.cover.remove")}
              </button>
            </div>
          )}
        </div>

        {urlPopover}
      </div>
    </div>
  );
});
