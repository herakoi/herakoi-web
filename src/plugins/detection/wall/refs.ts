import type { RefObject } from "react";

type WallRefs = {
  imageOverlay: RefObject<HTMLCanvasElement | null> | null;
};

export const wallRefs: WallRefs = {
  imageOverlay: null,
};
