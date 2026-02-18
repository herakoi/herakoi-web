import { useMemo } from "react";
import { useAppRuntimeStore } from "#src/app/state/appRuntimeStore";

/**
 * Shell-owned hook that reads UI opacity from the store and returns fade styles.
 * Pure rendering concern — no detection logic.
 */

// TODO: non ho capito a che serve se c'è già l'ui dimmer
export const useUiDimFade = () => {
  const uiOpacity = useAppRuntimeStore((s) => s.currentUiOpacity);

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
