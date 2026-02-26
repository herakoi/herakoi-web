import { type RefObject, useEffect, useState } from "react";

const DEFAULT_ASPECT_RATIO = 16 / 9;

const normalizeAspectRatio = (value: number | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

export const useVideoAspectRatio = (
  videoRef: RefObject<HTMLVideoElement>,
  fallbackAspectRatio = DEFAULT_ASPECT_RATIO,
) => {
  const [aspectRatio, setAspectRatio] = useState(fallbackAspectRatio);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateAspectRatio = () => {
      const dimensionAspectRatio = normalizeAspectRatio(
        video.videoWidth > 0 && video.videoHeight > 0
          ? video.videoWidth / video.videoHeight
          : undefined,
      );
      if (dimensionAspectRatio) {
        setAspectRatio(dimensionAspectRatio);
        return;
      }

      const trackSettingsAspectRatio = normalizeAspectRatio(
        (video.srcObject as MediaStream | null)?.getVideoTracks()?.[0]?.getSettings().aspectRatio,
      );
      setAspectRatio(trackSettingsAspectRatio ?? fallbackAspectRatio);
    };

    const resetAspectRatio = () => setAspectRatio(fallbackAspectRatio);

    updateAspectRatio();
    video.addEventListener("loadedmetadata", updateAspectRatio);
    video.addEventListener("loadeddata", updateAspectRatio);
    video.addEventListener("playing", updateAspectRatio);
    video.addEventListener("resize", updateAspectRatio);
    video.addEventListener("emptied", resetAspectRatio);
    window.addEventListener("resize", updateAspectRatio);
    window.addEventListener("orientationchange", updateAspectRatio);

    return () => {
      video.removeEventListener("loadedmetadata", updateAspectRatio);
      video.removeEventListener("loadeddata", updateAspectRatio);
      video.removeEventListener("playing", updateAspectRatio);
      video.removeEventListener("resize", updateAspectRatio);
      video.removeEventListener("emptied", resetAspectRatio);
      window.removeEventListener("resize", updateAspectRatio);
      window.removeEventListener("orientationchange", updateAspectRatio);
    };
  }, [fallbackAspectRatio, videoRef]);

  return aspectRatio;
};
