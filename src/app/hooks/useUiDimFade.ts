import { useMemo } from "react";
import { useAppRuntimeStore } from "#src/app/state/appRuntimeStore";

/**
 * Maps runtime UI opacity to CSS fade styles used by shell layout components.
 *
 * `useIdleDimmer` decides *when* opacity should change (interaction policy).
 * This hook decides *how* that value is rendered (transition timing/easing).
 */
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
