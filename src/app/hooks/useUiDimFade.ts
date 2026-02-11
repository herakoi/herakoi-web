import { useMemo } from "react";
import { usePipelineStore } from "#src/app/state/pipelineStore";

/**
 * Shell-owned hook that reads UI opacity from the store and returns fade styles.
 * Pure rendering concern — no detection logic.
 */
export const useUiDimFade = () => {
  const uiOpacity = usePipelineStore((s) => s.uiOpacity);

  const uiFadeStyle = useMemo(
    () => ({
      opacity: uiOpacity,
      transitionDuration: uiOpacity < 1 ? "7000ms" : "800ms",
      transitionTimingFunction: uiOpacity < 1 ? "ease-out" : "ease-in-out",
    }),
    [uiOpacity],
  );

  return { uiFadeStyle, uiDimmed: uiOpacity < 1 };
};
