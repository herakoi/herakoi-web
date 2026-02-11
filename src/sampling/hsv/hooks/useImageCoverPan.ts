import { useEffect, useRef } from "react";
import { hsvSamplingRefs } from "../refs";
import { useHSVSamplingStore } from "../store";

export const useImageCoverPan = () => {
  const imageCover = useHSVSamplingStore((state) => state.imageCover);
  const imagePan = useHSVSamplingStore((state) => state.imagePan);
  const setImagePan = useHSVSamplingStore((state) => state.setImagePan);
  const imagePanRef = useRef(imagePan);

  useEffect(() => {
    imagePanRef.current = imagePan;
  }, [imagePan]);

  useEffect(() => {
    const canvas = hsvSamplingRefs.imageCanvas?.current;
    if (!canvas) return;

    canvas.style.cursor = imageCover ? "grab" : "default";
    canvas.style.touchAction = imageCover ? "none" : "auto";
    if (!imageCover) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;

    const applyPan = () => {
      if (!pendingX && !pendingY) return;
      const current = imagePanRef.current;
      setImagePan({ x: current.x + pendingX, y: current.y + pendingY });
      pendingX = 0;
      pendingY = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      pendingX += dx;
      pendingY += dy;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          applyPan();
        });
      }
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.style.cursor = "grab";
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      applyPan();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      canvas.style.cursor = "default";
      canvas.style.touchAction = "auto";
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [imageCover, setImagePan]);
};
