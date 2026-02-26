import { useEffect, useRef } from "react";
import { useCanvasSizeSync } from "#src/shared/hooks/useCanvasSizeSync";
import { registerOverlayRef, registerVideoRef } from "../refs";
import { useVideoAspectRatio } from "./useVideoAspectRatio";
import { useVideoReady } from "./useVideoReady";

export const useMediaPipeDockBindings = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoReady = useVideoReady(videoRef);
  const videoAspectRatio = useVideoAspectRatio(videoRef);
  useCanvasSizeSync(overlayRef);

  useEffect(() => {
    if (videoRef.current) {
      registerVideoRef(videoRef);
    }
    if (overlayRef.current) {
      registerOverlayRef("videoOverlay", overlayRef);
    }
  }, []);

  return { videoRef, overlayRef, videoReady, videoAspectRatio };
};
