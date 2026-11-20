import type { ImageViewportMode } from "./types";

/**
 * Where the image was drawn: centre, drawn size and rotation, in canvas pixels.
 * Samplers that read the image itself (not the canvas) invert it to find image pixels.
 */
export type ImageTransform = {
  centerX: number;
  centerY: number;
  drawWidth: number;
  drawHeight: number;
  /** Radians, clockwise on screen. */
  rotation: number;
  imageWidth: number;
  imageHeight: number;
};

export type ImageLayout = {
  /** Full drawn rect (may extend beyond canvas in cover mode). */
  x: number;
  y: number;
  width: number;
  height: number;
  transform: ImageTransform;
};

/**
 * The image pixel under a canvas pixel, or null outside the image.
 * Inverse of the transform drawImageToCanvas applies.
 */
export const canvasToImagePixel = (
  transform: ImageTransform,
  canvasX: number,
  canvasY: number,
): { x: number; y: number } | null => {
  const dx = canvasX - transform.centerX;
  const dy = canvasY - transform.centerY;
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const u = (localX / transform.drawWidth + 0.5) * transform.imageWidth;
  const v = (localY / transform.drawHeight + 0.5) * transform.imageHeight;
  if (u < 0 || v < 0 || u >= transform.imageWidth || v >= transform.imageHeight) return null;
  return { x: Math.floor(u), y: Math.floor(v) };
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

/** Anything the samplers draw: a decoded image or a rendered canvas. */
export type DrawableImage = HTMLImageElement | HTMLCanvasElement;

const sourceSize = (image: DrawableImage) =>
  image instanceof HTMLImageElement
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };

export const drawImageToCanvas = (
  canvas: HTMLCanvasElement,
  image: DrawableImage,
  viewportMode: ImageViewportMode,
): ImageLayout | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width: imageWidth, height: imageHeight } = sourceSize(image);
  const baseScale =
    viewportMode.kind === "cover"
      ? Math.max(canvas.width / imageWidth, canvas.height / imageHeight)
      : Math.min(canvas.width / imageWidth, canvas.height / imageHeight);
  const scale = viewportMode.kind === "cover" ? baseScale * viewportMode.zoom : baseScale;
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
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
  const rotationDeg = viewportMode.kind === "cover" ? (viewportMode.rotation ?? 0) : 0;
  const rotation = (rotationDeg * Math.PI) / 180;
  const centerX = offsetX + drawWidth / 2;
  const centerY = offsetY + drawHeight / 2;

  const corners = [
    { x: -drawWidth / 2, y: -drawHeight / 2 },
    { x: drawWidth / 2, y: -drawHeight / 2 },
    { x: drawWidth / 2, y: drawHeight / 2 },
    { x: -drawWidth / 2, y: drawHeight / 2 },
  ].map((corner) => {
    const x = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation) + centerX;
    const y = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation) + centerY;
    return { x, y };
  });
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    transform: {
      centerX,
      centerY,
      drawWidth,
      drawHeight,
      rotation,
      imageWidth,
      imageHeight,
    },
  };
};
