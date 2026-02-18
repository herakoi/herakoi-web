import { useCallback, useEffect, useRef } from "react";
import { useAppRuntimeStore } from "../state/appRuntimeStore";

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

type UseIdleDimmerOptions = {
  /** Base opacity to restore to (0-1), typically from persisted UI preferences */
  baseOpacity: number;
  /** Target opacity when dimmed (0–1), default 0.15 */
  dimOpacity?: number;
  /** Idle delay before dimming (ms), default 5000 */
  delayMs?: number;
};

/**
 * App-level idle dimming policy.
 *
 * Reads:
 * - `hasDetectedPoints` from runtime store to enable/disable dimming
 * - `setCurrentUiOpacity` from runtime store to apply opacity
 */
export const useIdleDimmer = ({
  baseOpacity,
  dimOpacity = 0.15,
  delayMs = 5000,
}: UseIdleDimmerOptions) => {
  const active = useAppRuntimeStore((state) => state.hasDetectedPoints);
  const setUiOpacity = useAppRuntimeStore((state) => state.setCurrentUiOpacity);
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
