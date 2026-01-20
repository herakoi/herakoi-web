import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  formatImageType,
  loadImageDimensions,
  readFileAsDataUrl,
} from "../lib/imageUtils";
import { IMAGE_SELECTION_KEY } from "../state/persistenceKeys";
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

const readStoredImageId = () => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(IMAGE_SELECTION_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { id?: string } | null;
    return parsed?.id ?? null;
  } catch {
    return null;
  }
};

export const useImageLibrary = ({
  curatedImages,
  howItWorksImages,
  loadImageFile,
  loadImageSource,
}: UseImageLibraryArgs) => {
  const [storedImageId, setStoredImageId] = useState(readStoredImageId);
  const restoreSelectionRef = useRef(false);
  const selectionTokenRef = useRef(0);
  const [imageHydrated, setImageHydrated] = useState(false);
  const [uploads, setUploads] = useState<ImageEntry[]>([]);
  const [currentImage, setCurrentImage] = useState<CurrentImage>(() => {
    const fallback = curatedImages[0] ?? howItWorksImages[0];
    if (storedImageId) {
      const initialMatch = [...howItWorksImages, ...curatedImages].find(
        (entry) => entry.id === storedImageId,
      );
      if (initialMatch) {
        return { id: initialMatch.id, title: initialMatch.title };
      }
    }
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

  const persistSelection = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    setStoredImageId(id);
    restoreSelectionRef.current = true;
    try {
      localStorage.setItem(IMAGE_SELECTION_KEY, JSON.stringify({ id }));
    } catch {
      // ignore
    }
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
      const token = selectionTokenRef.current + 1;
      selectionTokenRef.current = token;
      setCurrentImage({ id, title: file.name });
      try {
        await loadImageFile(file);
        if (selectionTokenRef.current === token) {
          persistSelection(id);
          setImageHydrated(true);
        }
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
      } catch {
        if (selectionTokenRef.current === token) {
          setImageHydrated(true);
        }
      }
    },
    [loadImageFile, persistSelection, persistUploads],
  );

  const handleSelectImage = useCallback(
    async (entry: ImageEntry) => {
      const token = selectionTokenRef.current + 1;
      selectionTokenRef.current = token;
      setCurrentImage({ id: entry.id, title: entry.title });
      try {
        await loadImageSource(entry.src);
      } catch {
        // ignore
      }
      if (selectionTokenRef.current !== token) return;
      persistSelection(entry.id);
      setImageHydrated(true);
    },
    [loadImageSource, persistSelection],
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

  useEffect(() => {
    if (restoreSelectionRef.current) return;
    if (!storedImageId) {
      restoreSelectionRef.current = true;
      setImageHydrated(true);
      return;
    }
    const match = entries.find((entry) => entry.id === storedImageId);
    if (!match) {
      restoreSelectionRef.current = true;
      setImageHydrated(true);
      return;
    }
    restoreSelectionRef.current = true;
    void handleSelectImage(match);
  }, [entries, handleSelectImage, storedImageId]);

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
