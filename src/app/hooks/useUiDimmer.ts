import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

type UseUiDimmerArgs = {
  handDetected: boolean;
  uiDimPercent: number;
  uiDimDelayMs?: number;
  uiDimFadeMs?: number;
  uiDimResetMs?: number;
};

export const useUiDimmer = ({
  handDetected,
  uiDimPercent,
  uiDimDelayMs = 5000,
  uiDimFadeMs = 7000,
  uiDimResetMs = 800,
}: UseUiDimmerArgs) => {
  const [uiDimmed, setUiDimmed] = useState(false);
  const uiIdleTimeoutRef = useRef<number | null>(null);
  const lastMouseMoveRef = useRef(now());
  const handDetectedRef = useRef(handDetected);

  const scheduleUiDimCheck = useCallback(() => {
    if (uiIdleTimeoutRef.current !== null) {
      window.clearTimeout(uiIdleTimeoutRef.current);
    }
    if (!handDetectedRef.current) {
      setUiDimmed(false);
      return;
    }
    const idleFor = now() - lastMouseMoveRef.current;
    if (idleFor >= uiDimDelayMs) {
      setUiDimmed(true);
      return;
    }
    setUiDimmed(false);
    uiIdleTimeoutRef.current = window.setTimeout(() => {
      if (!handDetectedRef.current) return;
      const idleNow = now() - lastMouseMoveRef.current;
      if (idleNow >= uiDimDelayMs) {
        setUiDimmed(true);
      }
    }, uiDimDelayMs - idleFor);
  }, [uiDimDelayMs]);

  useEffect(() => {
    handDetectedRef.current = handDetected;
    scheduleUiDimCheck();
    return () => {
      if (uiIdleTimeoutRef.current !== null) {
        window.clearTimeout(uiIdleTimeoutRef.current);
        uiIdleTimeoutRef.current = null;
      }
    };
  }, [handDetected, scheduleUiDimCheck]);

  useEffect(() => {
    const handleActivity = () => {
      lastMouseMoveRef.current = now();
      setUiDimmed(false);
      scheduleUiDimCheck();
    };
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [scheduleUiDimCheck]);

  const uiOpacity = uiDimmed ? uiDimPercent / 100 : 1;

  const uiFadeStyle = useMemo(
    () => ({
      opacity: uiOpacity,
      transitionDuration: uiDimmed ? `${uiDimFadeMs}ms` : `${uiDimResetMs}ms`,
      transitionTimingFunction: uiDimmed ? "ease-out" : "ease-in-out",
    }),
    [uiDimFadeMs, uiDimResetMs, uiDimmed, uiOpacity],
  );

  return { uiFadeStyle, uiDimmed };
};
