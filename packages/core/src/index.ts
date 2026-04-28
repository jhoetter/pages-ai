import { z } from "zod";

export const ActorTypeSchema = z.enum(["human", "agent", "system"]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const CommandEnvelopeSchema = z.object({
  command_id: z.string().uuid().optional(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  actor_id: z.string(),
  actor_type: ActorTypeSchema,
  session_id: z.string().optional(),
  idempotency_key: z.string().max(128).optional(),
  locale: z.string().optional(),
});
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

export const OperationSchema = z.object({
  op_type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type Operation = z.infer<typeof OperationSchema>;

export const CommandResultSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(["applied", "staged", "rejected", "failed"]),
  operations: z.array(OperationSchema),
  proposal_id: z.string().uuid().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const AssetRefSchema = z.object({
  provider: z.enum(["hofos", "standalone-s3", "external-url"]),
  object_key: z.string().optional(),
  url: z.string().optional(),
  version_id: z.string().optional(),
  mime_type: z.string(),
  size_bytes: z.number().optional(),
  display_name: z.string(),
  source_product: z.string().optional(),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

/** Command payload schemas */
export const PageCreatePayload = z.object({
  space_id: z.string().uuid(),
  parent_page_id: z.string().uuid().optional(),
  title: z.string().min(1),
  icon: z.string().optional(),
});
export const PageMovePayload = z.object({
  page_id: z.string().uuid(),
  parent_page_id: z.string().uuid().optional(),
  sort_order: z.number().optional(),
});
export const PageArchivePayload = z.object({
  page_id: z.string().uuid(),
  archived: z.boolean(),
});
export const PageUpdatePayload = z.object({
  page_id: z.string().uuid(),
  title: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  cover_image_url: z.string().max(4000).nullable().optional(),
  parent_page_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().optional(),
});
export const PageListPayload = z.object({
  space_id: z.string().uuid(),
  parent_page_id: z.string().uuid().optional(),
  all_in_space: z.boolean().optional(),
});
export const BlockAppendPayload = z.object({
  page_id: z.string().uuid(),
  parent_block_id: z.string().uuid().optional(),
  type: z.string(),
  text: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});
export const BlockInsertPayload = z.object({
  after_block_id: z.string().uuid(),
  type: z.string(),
  text: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});
export const BlockUpdatePayload = z.object({
  block_id: z.string().uuid(),
  type: z.string().optional(),
  text: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});
export const BlockMovePayload = z.object({
  block_id: z.string().uuid(),
  after_block_id: z.string().uuid().optional(),
  parent_block_id: z.string().uuid().optional(),
  /** When set, takes precedence over after_block_id fractional bump */
  sort_order: z.number().optional(),
});
export const BlockDeletePayload = z.object({
  block_id: z.string().uuid(),
});

export const DatabaseCreatePayload = z.object({
  space_id: z.string().uuid(),
  parent_page_id: z.string().uuid().optional(),
  title: z.string(),
});
export const DbPropertyAddPayload = z.object({
  database_id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  options: z.array(z.string()).optional(),
});
export const DbRowCreatePayload = z.object({
  database_id: z.string().uuid(),
  cells: z.record(z.string(), z.unknown()),
});
export const DbRowUpdatePayload = z.object({
  database_id: z.string().uuid(),
  row_id: z.string().uuid(),
  /** Merged into existing row.cells (shallow per-key). */
  cells: z.record(z.string(), z.unknown()),
});
export const DbViewCreatePayload = z.object({
  database_id: z.string().uuid(),
  type: z.enum(["table", "board", "list", "calendar"]),
  name: z.string(),
});
export const DbQueryPayload = z.object({
  database_id: z.string().uuid(),
  view_id: z.string().uuid(),
});

export const CommentCreatePayload = z.object({
  page_id: z.string().uuid(),
  block_id: z.string().uuid().optional(),
  body: z.record(z.string(), z.unknown()),
});

export const ProposalCreatePayload = z.object({
  space_id: z.string().uuid(),
  rationale: z.string(),
  commands: z.array(
    z.object({
      type: z.string(),
      payload: z.record(z.string(), z.unknown()),
      actor_id: z.string(),
      actor_type: ActorTypeSchema,
    }),
  ),
});

export const ProposalListPayload = z.object({
  space_id: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export type PagesAiHostCapabilities = {
  openAsset(ref: AssetRef): Promise<void>;
  openOfficeAsset?(ref: AssetRef): Promise<void>;
  fetchAssetBytes?(ref: AssetRef): Promise<ArrayBuffer>;
  createAssetFromFile?(file: File): Promise<AssetRef>;
};

export const EXIT = {
  OK: 0,
  USER: 1,
  AUTH: 2,
  NETWORK: 3,
  CONFLICT: 4,
  RATE: 5,
  VALIDATION: 6,
} as const;

export type SlashSection = "basic" | "link";

export type SlashCommandDef = {
  id: string;
  commandType: string;
  labelKey: string;
  blockType?: string;
  keywords: string[];
  /** Optional short glyph / emoji for menus (no icon font dependency). */
  icon?: string;
  section?: SlashSection;
  /** When true, UI opens a page search picker instead of inserting immediately. */
  openPagePicker?: boolean;
  /** When true, UI opens database create/link flow instead of a bare append. */
  openDatabasePicker?: boolean;
  /** When set, choosing this command opens a local file picker (after upload, inserts embed). */
  openFilePicker?: "file" | "image";
};

export const slashCommandRegistry: SlashCommandDef[] = [
  {
    id: "text",
    commandType: "block.append",
    labelKey: "editor.slash.text",
    blockType: "paragraph",
    keywords: ["text", "paragraph"],
    icon: "¶",
    section: "basic",
  },
  {
    id: "h1",
    commandType: "block.append",
    labelKey: "editor.slash.h1",
    blockType: "heading1",
    keywords: ["h1", "heading"],
    icon: "H1",
    section: "basic",
  },
  {
    id: "h2",
    commandType: "block.append",
    labelKey: "editor.slash.h2",
    blockType: "heading2",
    keywords: ["h2"],
    icon: "H2",
    section: "basic",
  },
  {
    id: "h3",
    commandType: "block.append",
    labelKey: "editor.slash.h3",
    blockType: "heading3",
    keywords: ["h3"],
    icon: "H3",
    section: "basic",
  },
  {
    id: "bullet",
    commandType: "block.append",
    labelKey: "editor.slash.bullet",
    blockType: "bullet",
    keywords: ["bullet", "ul"],
    icon: "•",
    section: "basic",
  },
  {
    id: "numbered",
    commandType: "block.append",
    labelKey: "editor.slash.numbered",
    blockType: "numbered",
    keywords: ["numbered", "ol"],
    icon: "1.",
    section: "basic",
  },
  {
    id: "todo",
    commandType: "block.append",
    labelKey: "editor.slash.todo",
    blockType: "todo",
    keywords: ["todo", "checkbox"],
    icon: "☐",
    section: "basic",
  },
  {
    id: "toggle",
    commandType: "block.append",
    labelKey: "editor.slash.toggle",
    blockType: "toggle",
    keywords: ["toggle"],
    icon: "▸",
    section: "basic",
  },
  {
    id: "quote",
    commandType: "block.append",
    labelKey: "editor.slash.quote",
    blockType: "quote",
    keywords: ["quote"],
    icon: '"',
    section: "basic",
  },
  {
    id: "callout",
    commandType: "block.append",
    labelKey: "editor.slash.callout",
    blockType: "callout",
    keywords: ["callout"],
    icon: "ⓘ",
    section: "basic",
  },
  {
    id: "divider",
    commandType: "block.append",
    labelKey: "editor.slash.divider",
    blockType: "divider",
    keywords: ["divider", "hr"],
    icon: "—",
    section: "basic",
  },
  {
    id: "code",
    commandType: "block.append",
    labelKey: "editor.slash.code",
    blockType: "code",
    keywords: ["code"],
    icon: "</>",
    section: "basic",
  },
  {
    id: "database",
    commandType: "block.append",
    labelKey: "editor.slash.database",
    blockType: "database",
    keywords: ["database", "db"],
    icon: "▦",
    section: "basic",
    openDatabasePicker: true,
  },
  {
    id: "file_embed",
    commandType: "block.append",
    labelKey: "editor.slash.file",
    blockType: "file_embed",
    keywords: ["file", "upload", "attachment", "datei", "anhang"],
    icon: "📎",
    section: "basic",
    openFilePicker: "file",
  },
  {
    id: "image_embed",
    commandType: "block.append",
    labelKey: "editor.slash.image",
    blockType: "file_embed",
    keywords: ["image", "img", "picture", "photo", "bild"],
    icon: "🖼",
    section: "basic",
    openFilePicker: "image",
  },
  {
    id: "page_link",
    commandType: "block.append",
    labelKey: "editor.slash.pageLink",
    blockType: "page_link",
    keywords: ["link", "page", "mention", "wikilink", "seite"],
    icon: "🔗",
    section: "link",
    openPagePicker: true,
  },
];
