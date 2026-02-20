import { curatedImages } from "../data/curatedImages";
import { howItWorksImages } from "../data/howItWorksImages";
import type { ImageEntry } from "../types/image";

const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

const readUploadedImages = (): ImageEntry[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(IMAGE_CACHE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as ImageEntry[];
    return parsed.filter((entry) => entry.kind === "upload");
  } catch {
    return [];
  }
};

export const getDefaultImageId = (): string | null =>
  curatedImages[0]?.id ?? howItWorksImages[0]?.id ?? null;

export const resolveImageSourceById = (id: string | null | undefined): string | null => {
  if (!id) return null;
  const bundled = [...howItWorksImages, ...curatedImages].find((entry) => entry.id === id);
  if (bundled) return bundled.src;
  const uploaded = readUploadedImages().find((entry) => entry.id === id);
  return uploaded?.src ?? null;
};
