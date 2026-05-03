import type { ReactNode } from "react";
import {
  Archive,
  File,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Presentation,
  type LucideProps,
} from "lucide-react";
import { PdfFileIcon } from "@/components/PdfFileIcon";
import { fileIconKind } from "@/lib/fileIconKind";

/** MIME / extension icon — same mapping as drive-ai `DriveItemIcon` (token color via `className` + `currentColor`). */
export function FileTypeIcon(props: {
  name: string;
  type?: string;
  mime?: string | null;
  size?: "sm" | "md";
  className?: string;
}): ReactNode {
  const dim = props.size === "md" ? 22 : 18;
  const common: LucideProps = {
    size: dim,
    className: props.className,
    "aria-hidden": true,
    strokeWidth: 2,
  };

  switch (fileIconKind({ name: props.name, type: props.type, mime: props.mime })) {
    case "folder":
      return <Folder {...common} />;
    case "image":
      return <FileImage {...common} />;
    case "video":
      return <FileVideo {...common} />;
    case "audio":
      return <FileAudio {...common} />;
    case "pdf":
      return <PdfFileIcon size={dim} className={props.className} />;
    case "spreadsheet":
      return <FileSpreadsheet {...common} />;
    case "presentation":
      return <Presentation {...common} />;
    case "archive":
      return <Archive {...common} />;
    case "document":
      return <FileText {...common} />;
    case "code":
      return <FileCode {...common} />;
    default:
      return <File {...common} />;
  }
}
