/** Inline feedback while a file is uploading to S3 (slash menu or + add block). */
export function FileUploadProgress(props: {
  fileName: string;
  /** 0–100 when known; `null` = indeterminate */
  percent: number | null;
  statusLabel: string;
}) {
  const pct = props.percent;
  return (
    <div
      className="flex flex-col gap-2 py-2.5 px-3 rounded-lg bg-[var(--pa-surface)] border border-[var(--pa-divider)] shadow-lg min-w-[12.5rem] max-w-[min(100%,17.5rem)]"
      style={{ boxShadow: "var(--pa-popover-shadow)" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-xs text-[var(--pa-secondary)] truncate" title={props.fileName}>
        {props.fileName}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-4 shrink-0 rounded-full border-2 border-[var(--pa-accent)] border-t-transparent motion-safe:animate-spin"
          aria-hidden
        />
        <div className="flex-1 h-1.5 bg-[var(--pa-hover)] rounded-full overflow-hidden">
          {pct != null ? (
            <div
              className="h-full bg-[var(--pa-accent)] motion-safe:transition-[width] motion-safe:duration-150"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          ) : (
            <div className="h-full w-1/3 bg-[var(--pa-accent)] motion-safe:animate-pulse rounded-full" />
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--pa-tertiary)]">{props.statusLabel}</p>
    </div>
  );
}
