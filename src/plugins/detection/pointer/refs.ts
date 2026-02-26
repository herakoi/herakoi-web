import type { RefObject } from "react";

type PointerDetectionRefs = {
  imageOverlay: RefObject<HTMLCanvasElement> | null;
};

export const pointerDetectionRefs: PointerDetectionRefs = {
  imageOverlay: null,
};
