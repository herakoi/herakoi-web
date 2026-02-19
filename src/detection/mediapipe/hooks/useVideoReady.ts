import { type RefObject, useEffect, useState } from "react";

export const useVideoReady = (videoRef: RefObject<HTMLVideoElement>) => {
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markReady = () => setVideoReady(true);
    const markNotReady = () => setVideoReady(false);
    const updateState = () => {
      const hasStream = Boolean(video.srcObject);
      const isReady = hasStream && video.readyState >= 2 && !video.paused;
      setVideoReady(isReady);
    };

    updateState();
    video.addEventListener("playing", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("pause", markNotReady);
    video.addEventListener("emptied", markNotReady);

    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("pause", markNotReady);
      video.removeEventListener("emptied", markNotReady);
    };
  }, [videoRef]);

  return videoReady;
};
