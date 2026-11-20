import { isError, tryAsync } from "errore";
import { type ChangeEvent, useCallback, useEffect, useMemo } from "react";
import type { ErrorOr } from "#src/core/interfaces";
import { ImageDecodeError, ImageReadError, ImageSelectError } from "./errors";
import { useLocalizeImageEntry, useT } from "./i18n";
import { formatBytes, formatImageType, loadImageDimensions, readFileAsDataUrl } from "./imageUtils";
import type { ImageRuntimeStore } from "./runtimeStore";
import type { ImageEntry } from "./types";

/** Turns an uploaded file into a library entry. Errors are shown in the library. */
export type ReadUpload = (file: File, id: string) => Promise<ErrorOr<ImageEntry>>;

/** Default upload reader: a browser-decodable image stored as a data URL. */
export const readImageUpload: ReadUpload = async (file, id) => {
  const dataUrl = await tryAsync({
    try: async () => readFileAsDataUrl(file),
    catch: (error) => new ImageReadError({ cause: error }),
  });
  if (isError(dataUrl)) return dataUrl;

  const dimensions = await tryAsync({
    try: async () => loadImageDimensions(dataUrl),
    catch: (error) => new ImageDecodeError({ cause: error }),
  });
  if (isError(dimensions)) return dimensions;

  const { width, height } = dimensions;
  return {
    id,
    title: file.name,
    meta: `${width}x${height} - ${formatBytes(file.size)} - ${formatImageType(file.type)}`,
    src: dataUrl,
    previewSrc: dataUrl,
    kind: "upload",
    addedAt: Date.now(),
  };
};

type UseImageLibraryArgs = {
  store: ImageRuntimeStore;
  curatedImages: ImageEntry[];
  howItWorksImages: ImageEntry[];
  selectedImageId: string | null;
  onSelectImage: (entry: ImageEntry) => Promise<void>;
  readUpload?: ReadUpload;
  /** Called after an upload is removed from the library, e.g. to free stored bytes. */
  onDeleteUpload?: (entry: ImageEntry) => void;
};

export const useImageLibrary = ({
  store,
  curatedImages,
  howItWorksImages,
  selectedImageId,
  onSelectImage,
  readUpload = readImageUpload,
  onDeleteUpload,
}: UseImageLibraryArgs) => {
  const uploads = store((state) => state.uploads);
  const imageHydrated = store((state) => state.uploadsHydrated);
  const hydrateUploads = store((state) => state.hydrateUploads);
  const upsertUpload = store((state) => state.upsertUpload);
  const removeUpload = store((state) => state.removeUpload);
  const setImageLibraryOk = store((state) => state.setImageLibraryOk);
  const setImageLibraryError = store((state) => state.setImageLibraryError);

  useEffect(() => {
    hydrateUploads();
  }, [hydrateUploads]);

  const localizeEntry = useLocalizeImageEntry();
  const translate = useT();

  const entries = useMemo(
    () => [...howItWorksImages, ...curatedImages, ...uploads].map(localizeEntry),
    [curatedImages, howItWorksImages, uploads, localizeEntry],
  );

  const currentImage = useMemo(() => {
    const selectedEntry = entries.find((entry) => entry.id === selectedImageId);
    const fallbackEntry = curatedImages[0] ?? howItWorksImages[0] ?? uploads[0];
    const entry = selectedEntry ?? (fallbackEntry ? localizeEntry(fallbackEntry) : undefined);
    return {
      id: entry?.id ?? "curated-default",
      title: entry?.title ?? translate("image.fallbackTitle"),
    };
  }, [
    selectedImageId,
    entries,
    curatedImages,
    howItWorksImages,
    uploads,
    localizeEntry,
    translate,
  ]);

  const handleImageFile = useCallback(
    async (file: File): Promise<ErrorOr<undefined>> => {
      const id = `upload-${file.name}-${file.size}-${file.lastModified}`;
      const entry = await readUpload(file, id);
      if (isError(entry)) {
        setImageLibraryError(entry);
        return entry;
      }

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
    [onSelectImage, readUpload, setImageLibraryError, setImageLibraryOk, upsertUpload],
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
      onDeleteUpload?.(entry);
      if (selectedImageId === entry.id) {
        const fallback = curatedImages[0] ?? howItWorksImages[0] ?? nextUploads[0];
        if (fallback) {
          void handleSelectImage(fallback);
        }
      }
    },
    [
      curatedImages,
      handleSelectImage,
      howItWorksImages,
      onDeleteUpload,
      removeUpload,
      selectedImageId,
      uploads,
    ],
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
