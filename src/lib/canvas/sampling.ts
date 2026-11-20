import { type ImageSample, pointPositionKeys } from "#src/core/interfaces";

export type SamplePoint = {
  id: string;
  x: number;
  y: number;
};

export type CanvasSize = {
  width: number;
  height: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export const mapPointToCanvasSpace = <T extends SamplePoint>(
  point: T,
  sourceSize: Size | null | undefined,
  canvasSize: CanvasSize,
) => {
  const { width: canvasW, height: canvasH } = canvasSize;
  if (
    !sourceSize ||
    sourceSize.width <= 0 ||
    sourceSize.height <= 0 ||
    canvasW <= 0 ||
    canvasH <= 0
  ) {
    return { x: point.x, y: point.y };
  }

  // Map video-space point to canvas-space using cover fit.
  const scale = Math.max(canvasW / sourceSize.width, canvasH / sourceSize.height);
  const drawW = sourceSize.width * scale;
  const drawH = sourceSize.height * scale;
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;

  return {
    x: (offsetX + point.x * drawW) / canvasW,
    y: (offsetY + point.y * drawH) / canvasH,
  };
};

export const isPointInsideVisibleRect = (
  point: { x: number; y: number },
  visibleRect: Rect | null | undefined,
  canvasSize: CanvasSize,
) => {
  if (!visibleRect) return true;

  const { width: canvasW, height: canvasH } = canvasSize;
  const px = point.x * canvasW;
  const py = point.y * canvasH;

  return !(
    px < visibleRect.x ||
    px > visibleRect.x + visibleRect.width ||
    py < visibleRect.y ||
    py > visibleRect.y + visibleRect.height
  );
};

export const mapDetectedPointsForSampling = <T extends SamplePoint>(params: {
  points: T[];
  sourceSize: Size | null | undefined;
  visibleRect: Rect | null | undefined;
  canvasSize: CanvasSize;
}) => {
  const { points, sourceSize, visibleRect, canvasSize } = params;
  const mappedPoints: T[] = [];

  for (const point of points) {
    const mappedPoint = {
      ...point,
      ...mapPointToCanvasSpace(point, sourceSize, canvasSize),
    } as T;
    if (!isPointInsideVisibleRect(mappedPoint, visibleRect, canvasSize)) continue;
    mappedPoints.push(mappedPoint);
  }

  return mappedPoints;
};

/**
 * Add each point's canvas position (see `pointPositionKeys`) to its sample, so sonifiers
 * can follow the point's motion. Points are normalised to the canvas (0–1 on each axis).
 */
export const attachPointPositions = (
  samples: Map<string, ImageSample>,
  points: readonly SamplePoint[],
  canvasSize: CanvasSize,
): Map<string, ImageSample> => {
  const aspect = canvasSize.height > 0 ? canvasSize.width / canvasSize.height : 1;
  for (const point of points) {
    const sample = samples.get(point.id);
    if (!sample) continue;
    sample.data[pointPositionKeys.x] = point.x * aspect;
    sample.data[pointPositionKeys.y] = point.y;
  }
  return samples;
};
