import { useMemo } from "react";
import type { EngineHandlesStatus } from "#src/hooks/engine/useEngineHandles";
import type { TransportStatus } from "#src/hooks/engine/useTransportLoop";
import { ScreenReaderAnnouncer } from "./ScreenReaderAnnouncer";

type Props = {
  engineStatus: EngineHandlesStatus;
  transportStatus: TransportStatus;
};

/**
 * Announces engine status changes to screen readers.
 *
 * Converts status to human-readable messages using type-safe
 * discriminated union. Uses assertive politeness to immediately
 * interrupt screen reader output when status changes.
 */
export const EngineStatusAnnouncer = ({ engineStatus, transportStatus }: Props) => {
  const message = useMemo(() => {
    if (engineStatus === "initializing") {
      return "Engine initializing";
    }
    if (engineStatus instanceof Error) {
      return `Engine error: ${engineStatus.message}`;
    }
    switch (transportStatus.status) {
      case "running":
        return "Engine running";
      case "error":
        return `Transport error: ${transportStatus.error.message}`;
      case "stopped":
        return "Engine stopped";
      default:
        return "";
    }
  }, [engineStatus, transportStatus]);

  return <ScreenReaderAnnouncer message={message} politeness="assertive" />;
};
