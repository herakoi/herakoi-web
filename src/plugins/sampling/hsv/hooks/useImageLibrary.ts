import { isError, tryAsync } from "errore";
import { type ChangeEvent, useCallback, useEffect, useMemo } from "react";
import { ImageDecodeError, ImageReadError, ImageSelectError } from "#src/core/domain-errors";
import type { ErrorOr } from "#src/core/interfaces";
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
  const setImageLibraryOk = useHSVRuntimeStore((state) => state.setImageLibraryOk);
  const setImageLibraryError = useHSVRuntimeStore((state) => state.setImageLibraryError);

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
    async (file: File): Promise<ErrorOr<undefined>> => {
      const id = `upload-${file.name}-${file.size}-${file.lastModified}`;
      const dataUrl = await tryAsync({
        try: async () => readFileAsDataUrl(file),
        catch: (error) => new ImageReadError({ cause: error }),
      });
      if (isError(dataUrl)) {
        setImageLibraryError(dataUrl);
        return dataUrl;
      }

      const dimensions = await tryAsync({
        try: async () => loadImageDimensions(dataUrl),
        catch: (error) => new ImageDecodeError({ cause: error }),
      });
      if (isError(dimensions)) {
        setImageLibraryError(dimensions);
        return dimensions;
      }

      const { width, height } = dimensions;
      const meta = `${width}x${height} - ${formatBytes(file.size)} - ${formatImageType(file.type)}`;
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
      const selectResult = await tryAsync({
        try: async () => onSelectImage(entry),
        catch: (error) => new ImageSelectError({ cause: error }),
      });
      if (isError(selectResult)) {
        setImageLibraryError(selectResult);
        return selectResult;
      }

      setImageLibraryOk();
    },
    [onSelectImage, setImageLibraryError, setImageLibraryOk, upsertUpload],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry): Promise<ErrorOr<undefined>> => {
      const result = await tryAsync({
        try: async () => onSelectImage(entry),
        catch: (error) => new ImageSelectError({ cause: error }),
      });
      if (isError(result)) {
        setImageLibraryError(result);
        return result;
      }
      setImageLibraryOk();
    },
    [onSelectImage, setImageLibraryError, setImageLibraryOk],
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
