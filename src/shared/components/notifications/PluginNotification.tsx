import { X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { ScreenReaderAnnouncer } from "#src/components/ScreenReaderAnnouncer";

export type PluginNotificationProps = {
  message: string;
  icon?: ComponentType<{ className?: string }>;
  screenReaderMessage?: string;
  politeness?: "polite" | "assertive";
  /** Called when the user dismisses the notification. If omitted, no dismiss button is shown. */
  onDismiss?: () => void;
  /** Custom pill content instead of icon+message */
  children?: ReactNode;
};

export const PluginNotification = ({
  message,
  icon: Icon,
  screenReaderMessage,
  politeness,
  onDismiss,
  children,
}: PluginNotificationProps) => {
  return (
    <>
      <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/45 px-6 py-3 backdrop-blur">
        {children ?? (
          <>
            {Icon && <Icon className="h-5 w-5 shrink-0 text-white/70" />}
            <span className="font-sans text-sm font-medium tracking-wide text-white/80">
              {message}
            </span>
          </>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="pointer-events-auto -mr-2 ml-1 shrink-0 rounded-full p-1 text-white/40 transition-colors hover:text-white/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <ScreenReaderAnnouncer message={screenReaderMessage ?? message} politeness={politeness} />
    </>
  );
};
