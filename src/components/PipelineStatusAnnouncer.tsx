import { useMemo } from "react";
import type { PipelineStatus } from "#src/state/appRuntimeStore";
import { ScreenReaderAnnouncer } from "./ScreenReaderAnnouncer";

type Props = {
  status: PipelineStatus;
};

/**
 * Announces pipeline status changes to screen readers.
 *
 * Converts status to human-readable messages using type-safe
 * discriminated union. Uses assertive politeness to immediately
 * interrupt screen reader output when status changes.
 */
export const PipelineStatusAnnouncer = ({ status }: Props) => {
  const message = useMemo(() => {
    switch (status.status) {
      case "initializing":
        return "Pipeline initializing";
      case "running":
        return "Pipeline running";
      case "error":
        // TypeScript knows errorMessage exists here due to discriminated union
        return `Pipeline error: ${status.errorMessage}`;
      case "idle":
        return "Pipeline stopped";
      default:
        return "";
    }
  }, [status]);

  return <ScreenReaderAnnouncer message={message} politeness="assertive" />;
};
