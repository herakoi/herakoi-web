import { curatedImages } from "./library/curatedImages";
import { howItWorksImages } from "./library/howItWorksImages";
import { readUploadCache } from "./runtimeStore";

export const getDefaultImageId = (): string | null =>
  curatedImages[0]?.id ?? howItWorksImages[0]?.id ?? null;

/** Resolve an image id to its source: bundled images first, then the given upload cache. */
export const resolveImageSource = (cacheKey: string, id: string | null | undefined) => {
  if (!id) return null;
  const bundled = [...howItWorksImages, ...curatedImages].find((entry) => entry.id === id);
  if (bundled) return bundled.src;
  const uploads = readUploadCache(cacheKey);
  if (uploads instanceof Error) return null;
  return uploads.find((entry) => entry.id === id)?.src ?? null;
};
