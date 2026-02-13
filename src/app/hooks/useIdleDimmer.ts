import { useCallback, useEffect, useRef } from "react";

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

type UseIdleDimmerOptions = {
  /** Whether dimming is active (e.g., hands detected) */
  active: boolean;
  /** Shell-provided action to set UI opacity */
  setUiOpacity: (opacity: number) => void;
  /** Base opacity to return to when not dimmed (0–1), default 1 */
  baseOpacity?: number;
  /** Target opacity when dimmed (0–1), default 0.15 */
  dimOpacity?: number;
  /** Idle delay before dimming (ms), default 5000 */
  delayMs?: number;
};

/**
 * Shared utility hook for idle-based UI dimming.
 * Plugins that want "dim on mouse idle" behavior can use this in their DockPanel.
 *
 * When `active` is true and mouse/keyboard is idle for `delayMs`, calls `setUiOpacity(dimOpacity)`.
 * On mouse move or keydown, calls `setUiOpacity(baseOpacity)`.
 * When `active` is false, restores to baseOpacity.
 */
export const useIdleDimmer = ({
  active,
  setUiOpacity,
  baseOpacity = 1,
  dimOpacity = 0.15,
  delayMs = 5000,
}: UseIdleDimmerOptions) => {
  const uiIdleTimeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef(now());
  const activeRef = useRef(active);

  const scheduleUiDimCheck = useCallback(() => {
    if (uiIdleTimeoutRef.current !== null) {
      window.clearTimeout(uiIdleTimeoutRef.current);
    }
    if (!activeRef.current) {
      setUiOpacity(baseOpacity);
      return;
    }
    const idleFor = now() - lastActivityRef.current;
    if (idleFor >= delayMs) {
      setUiOpacity(dimOpacity);
      return;
    }
    setUiOpacity(baseOpacity);
    uiIdleTimeoutRef.current = window.setTimeout(() => {
      if (!activeRef.current) return;
      const idleNow = now() - lastActivityRef.current;
      if (idleNow >= delayMs) {
        setUiOpacity(dimOpacity);
      }
    }, delayMs - idleFor);
  }, [baseOpacity, delayMs, dimOpacity, setUiOpacity]);

  useEffect(() => {
    activeRef.current = active;
    scheduleUiDimCheck();
    return () => {
      if (uiIdleTimeoutRef.current !== null) {
        window.clearTimeout(uiIdleTimeoutRef.current);
        uiIdleTimeoutRef.current = null;
      }
    };
  }, [active, scheduleUiDimCheck]);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = now();
      setUiOpacity(baseOpacity);
      scheduleUiDimCheck();
    };
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [baseOpacity, scheduleUiDimCheck, setUiOpacity]);
};
