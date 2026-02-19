import { type RefObject, useEffect } from "react";

export const useCanvasSizeSync = (canvasRef: RefObject<HTMLCanvasElement>) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);
};
