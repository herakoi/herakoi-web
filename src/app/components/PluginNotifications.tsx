import { Fragment } from "react";
import { useNotificationStore } from "#src/app/state/notificationStore";
import { usePipelineStore } from "#src/app/state/pipelineStore";
import { ScreenReaderAnnouncer } from "./ScreenReaderAnnouncer";

export const PluginNotifications = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const isRunning = usePipelineStore((s) => s.status) === "running";

  // Only show visual notifications when pipeline is running
  if (!isRunning || notifications.size === 0) return null;

  return (
    <>
      {[...notifications.entries()].map(([id, data]) => {
        const Icon = data.icon;
        return (
          <Fragment key={id}>
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-4 transition-opacity duration-700"
              aria-hidden="true"
            >
              <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/45 px-6 py-3 backdrop-blur">
                {Icon ? <Icon className="h-5 w-5 shrink-0 text-white/70" /> : null}
                <span className="font-sans text-sm font-medium tracking-wide text-white/80">
                  {data.message}
                </span>
              </div>
            </div>
            <ScreenReaderAnnouncer
              message={data.screenReaderMessage ?? data.message}
              politeness={data.politeness}
            />
          </Fragment>
        );
      })}
    </>
  );
};
