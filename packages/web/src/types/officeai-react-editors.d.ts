import type { ComponentType } from "react";

/** Props hosts pass to load a remote document — see office-ai `EmbeddedEditorProps` + per-format `initialSource`. */
type OfficeEditorEmbedProps = {
  readonly initialSource: { readonly url: string; readonly name?: string };
  readonly hideLocalFileOpen?: boolean;
  readonly room?: string | null;
};

declare module "@officeai/react-editors/components/pdf" {
  export const PdfEditor: ComponentType<OfficeEditorEmbedProps>;
}

declare module "@officeai/react-editors/components/docx" {
  export const DocxEditor: ComponentType<OfficeEditorEmbedProps>;
}

declare module "@officeai/react-editors/components/xlsx" {
  export const XlsxEditor: ComponentType<OfficeEditorEmbedProps>;
}

declare module "@officeai/react-editors/components/pptx" {
  export const PptxEditor: ComponentType<OfficeEditorEmbedProps>;
}
