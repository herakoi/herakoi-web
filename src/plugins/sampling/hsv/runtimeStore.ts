import { createImageRuntimeStore } from "#src/shared/image/runtimeStore";

/** Uploads of the HSV plugin persist under this localStorage key. */
export const hsvImageCacheKey = "herakoi.image-cache.v1";

export const useHSVRuntimeStore = createImageRuntimeStore(hsvImageCacheKey);
