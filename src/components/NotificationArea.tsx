import type { ReactNode } from "react";

/**
 * Positioned container for plugin notification pills.
 * Always renders children — each plugin decides when to show its own notifications.
 */
export const NotificationArea = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-start gap-3 px-4 pt-20 transition-opacity duration-700 sm:z-[1] sm:justify-center sm:pt-0">
      {children}
    </div>
  );
};
