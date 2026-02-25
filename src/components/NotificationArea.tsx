import type { ReactNode } from "react";
import { useAppRuntimeStore } from "../state/appRuntimeStore";

/**
 * Positioned container for plugin notification pills.
 * Renders children only when the pipeline is running.
 */
export const NotificationArea = ({ children }: { children?: ReactNode }) => {
  const isRunning = useAppRuntimeStore((s) => s.pipelineStatus.status === "running");

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 px-4 transition-opacity duration-700">
      {isRunning && children}
    </div>
  );
};
