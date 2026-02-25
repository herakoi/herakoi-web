import { useMemo } from "react";
import type { EngineStatus } from "#src/state/appRuntimeStore";
import { ScreenReaderAnnouncer } from "./ScreenReaderAnnouncer";

type Props = {
  status: EngineStatus;
};

/**
 * Announces engine status changes to screen readers.
 *
 * Converts status to human-readable messages using type-safe
 * discriminated union. Uses assertive politeness to immediately
 * interrupt screen reader output when status changes.
 */
export const EngineStatusAnnouncer = ({ status }: Props) => {
  const message = useMemo(() => {
    switch (status.status) {
      case "initializing":
        return "Engine initializing";
      case "running":
        return "Engine running";
      case "error":
        // TypeScript knows error exists here due to discriminated union
        return `Engine error: ${status.error.message}`;
      case "idle":
        return "Engine stopped";
      default:
        return "";
    }
  }, [status]);

  return <ScreenReaderAnnouncer message={message} politeness="assertive" />;
};
