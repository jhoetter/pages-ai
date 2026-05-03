import type { ReactNode } from "react";

/** Acrobat-style cue: folded page + solid lower band (same as drive-ai `PdfFileIcon`). */
export function PdfFileIcon(props: { size?: number; className?: string }): ReactNode {
  const s = props.size ?? 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={props.className} aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7" y="15" width="10" height="4.25" rx="0.6" fill="currentColor" />
    </svg>
  );
}
