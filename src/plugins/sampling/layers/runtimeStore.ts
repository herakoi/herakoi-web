import { createImageRuntimeStore } from "#src/shared/image/runtimeStore";

/** Uploads of the layers plugin persist under this localStorage key (FITS bytes in IndexedDB). */
export const layersImageCacheKey = "herakoi.layers-image-cache.v1";

export const useLayersRuntimeStore = createImageRuntimeStore(layersImageCacheKey);
