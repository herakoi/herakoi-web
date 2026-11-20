/** An entry of an image library: bundled, built-in, or uploaded by the user. */
export type ImageEntry = {
  id: string;
  title: string;
  meta: string;
  src: string;
  previewSrc: string;
  kind: "curated" | "how" | "upload";
  addedAt?: number;
  /** "fits" for FITS uploads, whose `src` is resolved by the plugin. Absent for plain images. */
  format?: "fits";
  /** Layer names of a layered upload, in file order. */
  layers?: string[];
};

/** How the image sits on the canvas. "cover" fills it and can be panned, zoomed and rotated. */
export type ImageViewportMode =
  // Deprecated: kept for compatibility with existing runtime flows.
  | { kind: "contain" }
  | { kind: "cover"; pan: { x: number; y: number }; zoom: number; rotation: number };

export type VisibleRect = { x: number; y: number; width: number; height: number };
