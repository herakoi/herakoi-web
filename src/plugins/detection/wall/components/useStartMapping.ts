import { useCallback } from "react";
import { useWallStore } from "../store";

/**
 * Starts the screen mapping. Mapping must run in full screen, as Herakoi does on the exhibit
 * screen; entering full screen needs the click's user activation, so it is requested first.
 */
export const useStartMapping = () => {
  const runMapping = useWallStore((s) => s.runMapping);
  const running = useWallStore((s) => s.mapping.status === "running");

  const start = useCallback(() => {
    if (!runMapping || running) return;
    const needsFullscreen = !document.fullscreenElement && document.fullscreenEnabled;
    const entered = needsFullscreen
      ? document.documentElement.requestFullscreen().catch(() => undefined)
      : Promise.resolve();
    void entered
      .then(() => new Promise((resolve) => setTimeout(resolve, needsFullscreen ? 800 : 0)))
      .then(() => runMapping());
  }, [runMapping, running]);

  return { start, disabled: !runMapping || running };
};
