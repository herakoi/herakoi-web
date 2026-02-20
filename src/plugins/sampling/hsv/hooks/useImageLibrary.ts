import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatBytes,
  formatImageType,
  loadImageDimensions,
  readFileAsDataUrl,
} from "../lib/imageUtils";
import type { ImageEntry } from "../types/image";

const LEGACY_IMAGE_SELECTION_KEY = "herakoi.image-selection.v1";
const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

type CurrentImage = {
  id: string;
  title: string;
};

type UseImageLibraryArgs = {
  curatedImages: ImageEntry[];
  howItWorksImages: ImageEntry[];
  onSelectImage: (entry: ImageEntry) => Promise<void>;
};

export const useImageLibrary = ({
  curatedImages,
  howItWorksImages,
  onSelectImage,
}: UseImageLibraryArgs) => {
  const imageHydrated = true;
  const [uploads, setUploads] = useState<ImageEntry[]>([]);
  const [currentImage, setCurrentImage] = useState<CurrentImage>(() => {
    const fallback = curatedImages[0] ?? howItWorksImages[0];
    return {
      id: fallback?.id ?? "curated-default",
      title: fallback?.title ?? "Curated image",
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ImageEntry[];
      setUploads(
        parsed
          .filter((entry) => entry.kind === "upload")
          .map((entry) => ({ ...entry, previewSrc: entry.previewSrc ?? entry.src })),
      );
    } catch {
      setUploads([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Legacy selection storage is removed; app-config is the source of truth.
    localStorage.removeItem(LEGACY_IMAGE_SELECTION_KEY);
  }, []);

  const persistUploads = useCallback((nextUploads: ImageEntry[]) => {
    try {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(nextUploads));
    } catch {
      // ignore
    }
  }, []);

  const handleImageFile = useCallback(
    async (file: File) => {
      const id = `upload-${file.name}-${file.size}-${file.lastModified}`;
      setCurrentImage({ id, title: file.name });
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await loadImageDimensions(dataUrl);
        const meta = `${width}x${height} - ${formatBytes(file.size)} - ${formatImageType(
          file.type,
        )}`;
        const entry: ImageEntry = {
          id,
          title: file.name,
          meta,
          src: dataUrl,
          previewSrc: dataUrl,
          kind: "upload",
          addedAt: Date.now(),
        };
        setUploads((prev) => {
          const next = [entry, ...prev.filter((item) => item.id !== id)];
          persistUploads(next);
          return next;
        });
        await onSelectImage(entry);
      } catch {
        // ignore
      }
    },
    [onSelectImage, persistUploads],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry) => {
      setCurrentImage({ id: entry.id, title: entry.title });
      try {
        await onSelectImage(entry);
      } catch {
        // ignore
      }
    },
    [onSelectImage],
  );

  const handleDeleteUpload = useCallback(
    (entry: ImageEntry) => {
      const nextUploads = uploads.filter((item) => item.id !== entry.id);
      setUploads(nextUploads);
      persistUploads(nextUploads);
      if (currentImage.id === entry.id) {
        const fallback = curatedImages[0] ?? howItWorksImages[0] ?? nextUploads[0];
        if (fallback) {
          void handleSelectImage(fallback);
        }
      }
    },
    [currentImage.id, curatedImages, handleSelectImage, howItWorksImages, persistUploads, uploads],
  );

  const entries = useMemo(
    () => [...howItWorksImages, ...curatedImages, ...uploads],
    [curatedImages, howItWorksImages, uploads],
  );

  const handleImageInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleImageFile(file);
      event.target.value = "";
    },
    [handleImageFile],
  );

  return {
    currentImage,
    entries,
    uploads,
    imageHydrated,
    handleImageFile,
    handleSelectImage,
    handleDeleteUpload,
    handleImageInput,
  };
};
