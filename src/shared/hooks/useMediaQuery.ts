import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Whether a CSS media query currently matches, updated as the viewport changes. */
export const useMediaQuery = (query: string): boolean => {
  const mediaQuery = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(query)
        : null,
    [query],
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!mediaQuery) return () => {};
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [mediaQuery],
  );

  return useSyncExternalStore(
    subscribe,
    () => mediaQuery?.matches ?? false,
    () => false,
  );
};
