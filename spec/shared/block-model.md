# Block model

## Block types (v1)

`paragraph`, `heading1`, `heading2`, `heading3`, `bullet`, `numbered`, `todo`, `toggle`, `quote`, `callout`, `divider`, `code`, `table`, `database`, `file_embed`, `page_link`.

## Rich text JSON

Lexical-compatible serialized tree subset:

```typescript
type RichTextRoot = {
  root: {
    type: "root";
    children: RichTextNode[];
  };
};
type RichTextNode =
  | { type: "paragraph" | "heading1" | ...; children: InlineNode[] }
  | { type: "text"; text: string; format?: number }
  | { type: "mention"; mentionType: "page" | "person"; id: string }
  | { type: "link"; url: string; children: InlineNode[] };
```

(Implementation uses Lexical `$generateJSONFromSelectedNodes` / import JSON.)

## Properties per type

- `todo`: `{ checked: boolean }`
- `callout`: `{ emoji?: string }`
- `code`: `{ language: string }`
- `file_embed`: `{ asset: AssetRef }`
- `database`: `{ database_id: string }`
- `page_link`: `{ linked_page_id: string }` (UUID of target page). Display title may be mirrored in block text via `paragraphFromText` until rich text is primary.

## Transforms

Pure functions in `@pagesai/documents`:

- `splitBlock`, `mergeBlocks`, `indent`, `outdent`, `setType`

## Slash registry

Each entry: `{ id, commandType, labelKey, icon, blockType?, keywords[] }` — invokes same handler as CLI `block.append --type`.
