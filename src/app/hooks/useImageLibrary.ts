import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatBytes,
  formatImageType,
  loadImageDimensions,
  readFileAsDataUrl,
} from "../lib/imageUtils";
import type { ImageEntry } from "../types/image";

const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

type CurrentImage = {
  id: string;
  title: string;
};

type UseImageLibraryArgs = {
  curatedImages: ImageEntry[];
  howItWorksImages: ImageEntry[];
  loadImageFile: (file: File) => Promise<void>;
  loadImageSource: (src: string) => Promise<void>;
};

export const useImageLibrary = ({
  curatedImages,
  howItWorksImages,
  loadImageFile,
  loadImageSource,
}: UseImageLibraryArgs) => {
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

  const persistUploads = useCallback((nextUploads: ImageEntry[]) => {
    try {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(nextUploads));
    } catch {}
  }, []);

  const handleImageFile = useCallback(
    async (file: File) => {
      await loadImageFile(file);
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
      } catch {}
    },
    [loadImageFile, persistUploads],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry) => {
      await loadImageSource(entry.src);
      setCurrentImage({ id: entry.id, title: entry.title });
    },
    [loadImageSource],
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

  const handleImageInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await handleImageFile(file);
      event.target.value = "";
    },
    [handleImageFile],
  );

  const entries = useMemo(
    () => [...howItWorksImages, ...curatedImages, ...uploads],
    [curatedImages, howItWorksImages, uploads],
  );

  return {
    currentImage,
    entries,
    uploads,
    handleImageFile,
    handleSelectImage,
    handleDeleteUpload,
    handleImageInput,
  };
};
