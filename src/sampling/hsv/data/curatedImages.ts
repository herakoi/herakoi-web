export type CuratedImageEntry = {
  id: string;
  title: string;
  meta: string;
  src: string;
  previewSrc: string;
  kind: "curated";
};

const formatCuratedTitle = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCuratedType = (filename: string) => {
  const ext = filename.split(".").pop();
  return ext ? ext.toUpperCase() : "IMG";
};

const curatedImageImports = import.meta.glob<string>("../assets/curated/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
});

export const curatedImages: CuratedImageEntry[] = Object.entries(curatedImageImports)
  .map(([path, src]) => {
    const filename = path.split("/").pop() ?? "curated-image";
    return {
      id: `curated-${filename.replace(/\.[^.]+$/, "")}`,
      title: formatCuratedTitle(filename),
      meta: `Curated - ${formatCuratedType(filename)}`,
      src,
      previewSrc: src,
      kind: "curated" as const,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const getDefaultCuratedImage = () => curatedImages[0] ?? null;
