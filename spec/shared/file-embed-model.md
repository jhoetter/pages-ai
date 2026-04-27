# File embed model

## AssetRef

```typescript
type AssetRef = {
  provider: "hofos" | "standalone-s3" | "external-url";
  object_key?: string;
  url?: string;
  version_id?: string;
  mime_type: string;
  size_bytes?: number;
  display_name: string;
  source_product?: string;
};
```

## Host capabilities

```typescript
type PagesAiHostCapabilities = {
  openAsset(ref: AssetRef): Promise<void>;
  openOfficeAsset?(ref: AssetRef): Promise<void>;
  fetchAssetBytes?(ref: AssetRef): Promise<ArrayBuffer>;
  createAssetFromFile?(file: File): Promise<AssetRef>;
};
```

## Blocks

- `file_embed` stores `AssetRef` in `properties.asset`.

## CLI

- `file embed --page ... --s3-key ...` creates block with `standalone-s3` provider.

## MIME → Office

- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → DOCX, etc.
- PDF: `application/pdf`.
