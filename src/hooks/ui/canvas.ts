import type { RefObject } from "react";

export const resizeCanvasToContainer = (canvas: HTMLCanvasElement) => {
  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width ?? canvas.clientWidth ?? 640);
  const height = Math.round(rect?.height ?? canvas.clientHeight ?? Math.round(width * 0.75)) || 480;
  canvas.width = width;
  canvas.height = height;
};

export const resizeCanvasRefToContainer = (canvasRef: RefObject<HTMLCanvasElement>) => {
  if (!canvasRef.current) return;
  resizeCanvasToContainer(canvasRef.current);
};
