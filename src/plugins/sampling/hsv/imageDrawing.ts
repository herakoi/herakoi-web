import type { HSVViewportMode } from "./config";

export type ImageLayout = {
  /** Full drawn rect (may extend beyond canvas in cover mode). */
  x: number;
  y: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const resizeCanvasToContainer = (canvas: HTMLCanvasElement) => {
  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width ?? canvas.clientWidth ?? 640);
  const height = Math.round(rect?.height ?? canvas.clientHeight ?? Math.round(width * 0.75)) || 480;
  canvas.width = width;
  canvas.height = height;
};

export const drawImageToCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  viewportMode: HSVViewportMode,
): ImageLayout | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const baseScale =
    viewportMode.kind === "cover"
      ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      : Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const scale = viewportMode.kind === "cover" ? baseScale * viewportMode.zoom : baseScale;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const baseOffsetX = (canvas.width - drawWidth) / 2;
  const baseOffsetY = (canvas.height - drawHeight) / 2;
  const extraX = Math.max(0, (drawWidth - canvas.width) / 2);
  const extraY = Math.max(0, (drawHeight - canvas.height) / 2);
  const offsetX =
    viewportMode.kind === "cover"
      ? clamp(baseOffsetX + viewportMode.pan.x, baseOffsetX - extraX, baseOffsetX + extraX)
      : baseOffsetX;
  const offsetY =
    viewportMode.kind === "cover"
      ? clamp(baseOffsetY + viewportMode.pan.y, baseOffsetY - extraY, baseOffsetY + extraY)
      : baseOffsetY;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return {
    x: offsetX,
    y: offsetY,
    width: drawWidth,
    height: drawHeight,
  };
};
