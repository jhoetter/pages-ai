import type { AssetRef } from "@pagesai/core";
import { apiUpload } from "./api";

export async function uploadFileForSpace(spaceId: string, file: File): Promise<AssetRef> {
  const res = await apiUpload<{ asset: AssetRef }>(`/api/spaces/${encodeURIComponent(spaceId)}/upload`, file);
  return res.asset;
}
