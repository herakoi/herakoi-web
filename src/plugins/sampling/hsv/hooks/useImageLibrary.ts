import { type ChangeEvent, useCallback, useEffect, useMemo } from "react";
import {
  formatBytes,
  formatImageType,
  loadImageDimensions,
  readFileAsDataUrl,
} from "../lib/imageUtils";
import { useHSVRuntimeStore } from "../runtimeStore";
import type { ImageEntry } from "../types/image";

type UseImageLibraryArgs = {
  curatedImages: ImageEntry[];
  howItWorksImages: ImageEntry[];
  selectedImageId: string | null;
  onSelectImage: (entry: ImageEntry) => Promise<void>;
};

export const useImageLibrary = ({
  curatedImages,
  howItWorksImages,
  selectedImageId,
  onSelectImage,
}: UseImageLibraryArgs) => {
  const uploads = useHSVRuntimeStore((state) => state.uploads);
  const imageHydrated = useHSVRuntimeStore((state) => state.uploadsHydrated);
  const hydrateUploads = useHSVRuntimeStore((state) => state.hydrateUploads);
  const upsertUpload = useHSVRuntimeStore((state) => state.upsertUpload);
  const removeUpload = useHSVRuntimeStore((state) => state.removeUpload);

  useEffect(() => {
    hydrateUploads();
  }, [hydrateUploads]);

  const entries = useMemo(
    () => [...howItWorksImages, ...curatedImages, ...uploads],
    [curatedImages, howItWorksImages, uploads],
  );

  const currentImage = useMemo(() => {
    const selectedEntry = entries.find((entry) => entry.id === selectedImageId);
    const fallbackEntry = curatedImages[0] ?? howItWorksImages[0] ?? uploads[0];
    const entry = selectedEntry ?? fallbackEntry;
    return {
      id: entry?.id ?? "curated-default",
      title: entry?.title ?? "Curated image",
    };
  }, [selectedImageId, entries, curatedImages, howItWorksImages, uploads]);

  const handleImageFile = useCallback(
    async (file: File) => {
      const id = `upload-${file.name}-${file.size}-${file.lastModified}`;
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
        upsertUpload(entry);
        await onSelectImage(entry);
      } catch {
        // ignore
      }
    },
    [onSelectImage, upsertUpload],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry) => {
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
      removeUpload(entry.id);
      if (selectedImageId === entry.id) {
        const fallback = curatedImages[0] ?? howItWorksImages[0] ?? nextUploads[0];
        if (fallback) {
          void handleSelectImage(fallback);
        }
      }
    },
    [curatedImages, handleSelectImage, howItWorksImages, removeUpload, selectedImageId, uploads],
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
