import { getDefaultImageId, resolveImageSource } from "#src/shared/image/imageSourceResolver";
import { layersImageCacheKey } from "../runtimeStore";

export { getDefaultImageId };

export const resolveImageSourceById = (id: string | null | undefined): string | null =>
  resolveImageSource(layersImageCacheKey, id);
