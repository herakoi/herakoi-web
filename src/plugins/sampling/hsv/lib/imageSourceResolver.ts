import { getDefaultImageId, resolveImageSource } from "#src/shared/image/imageSourceResolver";
import { hsvImageCacheKey } from "../runtimeStore";

export { getDefaultImageId };

export const resolveImageSourceById = (id: string | null | undefined): string | null =>
  resolveImageSource(hsvImageCacheKey, id);
