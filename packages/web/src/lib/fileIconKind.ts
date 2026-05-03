/** Canonical file kind for Lucide / PDF badge icons — aligned with drive-ai `driveIconKind`. */

export type FileIconKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "document"
  | "code"
  | "file";

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function fileIconKind(input: {
  name: string;
  /** Use `"folder"` for directory rows; default treat as file. */
  type?: string;
  mime?: string | null;
}): FileIconKind {
  if (input.type === "folder") return "folder";

  const mime = (input.mime ?? "").toLowerCase();
  const ext = extFromName(input.name);

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    ["xlsx", "xls", "csv", "ods"].includes(ext)
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx", "key"].includes(ext)
  ) {
    return "presentation";
  }
  if (["zip", "tar", "gz", "tgz", "rar", "7z", "bz2"].includes(ext)) return "archive";
  if (
    ["txt", "md", "rtf", "doc", "docx", "odt"].includes(ext) ||
    mime.includes("text/") ||
    mime.includes("wordprocessing")
  ) {
    return "document";
  }
  if (
    ["json", "xml", "yml", "yaml", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "sql"].includes(
      ext,
    ) ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json")
  ) {
    return "code";
  }
  return "file";
}

const KIND_ICON_VARS: Record<FileIconKind, string> = {
  folder: "var(--pa-kind-folder)",
  image: "var(--pa-kind-image)",
  video: "var(--pa-kind-video)",
  audio: "var(--pa-kind-audio)",
  pdf: "var(--pa-kind-pdf)",
  spreadsheet: "var(--pa-kind-spreadsheet)",
  presentation: "var(--pa-kind-presentation)",
  archive: "var(--pa-kind-archive)",
  document: "var(--pa-kind-document)",
  code: "var(--pa-kind-code)",
  file: "var(--pa-kind-file)",
};

/** Resolved `color` for Lucide / PDF badge (uses `--pa-kind-*` in `index.css`). */
export function fileKindIconColorVar(kind: FileIconKind): string {
  return KIND_ICON_VARS[kind];
}

/** i18n key under `file.kind.<kind>`. */
export function fileKindLabelKey(kind: FileIconKind): string {
  return `file.kind.${kind}`;
}
