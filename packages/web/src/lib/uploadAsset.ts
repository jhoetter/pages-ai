import type { AssetRef } from "@pagesai/core";
import { apiUploadWithProgress } from "./api";

export async function uploadFileForSpace(
  spaceId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<AssetRef> {
  const res = await apiUploadWithProgress<{ asset: AssetRef }>(
    `/api/spaces/${encodeURIComponent(spaceId)}/upload`,
    file,
    { onProgress },
  );
  return res.asset;
}
