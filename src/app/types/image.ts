export type ImageEntry = {
  id: string;
  title: string;
  meta: string;
  src: string;
  previewSrc: string;
  kind: "curated" | "how" | "upload";
  addedAt?: number;
};
