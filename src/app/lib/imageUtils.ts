export const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatImageType = (mimeType: string) => {
  const [, subtype] = mimeType.split("/");
  return subtype ? subtype.toUpperCase() : "IMG";
};

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image data"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(file);
  });

export const loadImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image metadata"));
    img.src = src;
  });
