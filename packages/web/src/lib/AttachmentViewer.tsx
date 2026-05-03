// PDF / OOXML previews via @officeai/react-editors — same stack as
// collaboration-ai, mail-ai, and hof-os /edit-asset. Staged by
// `scripts/ensure-officeai-react-editors.cjs` from infra/officeai.lock.json.

import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

/** Mirrors `@officeai/react-editors` embed contract: document URL must be passed as `initialSource`, not `url`. */
type OfficeEditorEmbedProps = {
  readonly initialSource: { readonly url: string; readonly name?: string };
  readonly hideLocalFileOpen: boolean;
  readonly room: null;
};

function OfficeEditorLoadError({ format, error }: { format: string; error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
      style={{
        borderColor: "var(--pa-divider)",
        background: "var(--pa-surface)",
      }}
    >
      <p className="text-sm font-medium text-[var(--pa-fg)]">{format} preview unavailable</p>
      <p className="max-w-md text-xs text-[var(--pa-secondary)]">
        @officeai/react-editors could not be loaded. Run{" "}
        <code className="text-[11px]">pnpm install</code> in pages-ai (postinstall stages editors)
        or use download while the bundle is unavailable.
      </p>
      <code className="max-w-md break-all rounded px-2 py-1 text-[11px] text-[var(--pa-tertiary)] bg-[var(--pa-hover)]">
        {message}
      </code>
    </div>
  );
}

const PdfEditor = lazy(async (): Promise<{ default: ComponentType<OfficeEditorEmbedProps> }> => {
  try {
    const mod = await import("@officeai/react-editors/components/pdf");
    return { default: mod.PdfEditor as ComponentType<OfficeEditorEmbedProps> };
  } catch (error) {
    return { default: () => <OfficeEditorLoadError format="PDF" error={error} /> };
  }
});

const DocxEditor = lazy(async (): Promise<{ default: ComponentType<OfficeEditorEmbedProps> }> => {
  try {
    const mod = await import("@officeai/react-editors/components/docx");
    return { default: mod.DocxEditor as ComponentType<OfficeEditorEmbedProps> };
  } catch (error) {
    return { default: () => <OfficeEditorLoadError format="DOCX" error={error} /> };
  }
});

const XlsxEditor = lazy(async (): Promise<{ default: ComponentType<OfficeEditorEmbedProps> }> => {
  try {
    const mod = await import("@officeai/react-editors/components/xlsx");
    return { default: mod.XlsxEditor as ComponentType<OfficeEditorEmbedProps> };
  } catch (error) {
    return { default: () => <OfficeEditorLoadError format="XLSX" error={error} /> };
  }
});

const PptxEditor = lazy(async (): Promise<{ default: ComponentType<OfficeEditorEmbedProps> }> => {
  try {
    const mod = await import("@officeai/react-editors/components/pptx");
    return { default: mod.PptxEditor as ComponentType<OfficeEditorEmbedProps> };
  } catch (error) {
    return { default: () => <OfficeEditorLoadError format="PPTX" error={error} /> };
  }
});

export type AttachmentKind = "pdf" | "docx" | "xlsx" | "pptx" | "other";

export function attachmentKindFor(mime: string, filename?: string): AttachmentKind {
  const ext = (filename ?? "").toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx")
    return "docx";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || ext === "xlsx")
    return "xlsx";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || ext === "pptx")
    return "pptx";
  return "other";
}

export interface AttachmentViewerProps {
  readonly url: string;
  readonly mime: string;
  readonly filename: string;
}

export function AttachmentViewer(props: AttachmentViewerProps) {
  const kind = attachmentKindFor(props.mime, props.filename);
  const embed: OfficeEditorEmbedProps = {
    initialSource: { url: props.url, name: props.filename },
    hideLocalFileOpen: true,
    room: null,
  };
  return (
    <Suspense
      fallback={
        <div className="min-h-[20rem] p-6 text-sm text-[var(--pa-secondary)]">Loading preview…</div>
      }
    >
      {kind === "pdf" && <PdfEditor {...embed} />}
      {kind === "docx" && <DocxEditor {...embed} />}
      {kind === "xlsx" && <XlsxEditor {...embed} />}
      {kind === "pptx" && <PptxEditor {...embed} />}
      {kind === "other" && (
        <a
          href={props.url}
          target="_blank"
          rel="noreferrer"
          download={props.filename}
          className="text-[var(--pa-accent)] underline underline-offset-2"
        >
          {props.filename}
        </a>
      )}
    </Suspense>
  );
}
