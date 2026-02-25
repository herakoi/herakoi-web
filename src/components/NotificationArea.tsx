import type { ReactNode } from "react";

/**
 * Positioned container for plugin notification pills.
 * Always renders children — each plugin decides when to show its own notifications.
 */
export const NotificationArea = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 px-4 transition-opacity duration-700">
      {children}
    </div>
  );
};
