import { useEffect, useRef } from "react";
import { useCanvasSizeSync } from "#src/app/hooks/useCanvasSizeSync";
import { useVideoReady } from "#src/app/hooks/useVideoReady";
import { registerOverlayRef, registerVideoRef } from "../refs";

export const useMediaPipeDockBindings = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoReady = useVideoReady(videoRef);
  useCanvasSizeSync(overlayRef);

  useEffect(() => {
    if (videoRef.current) {
      registerVideoRef(videoRef);
    }
    if (overlayRef.current) {
      registerOverlayRef("videoOverlay", overlayRef);
    }
  }, []);

  return { videoRef, overlayRef, videoReady };
};
