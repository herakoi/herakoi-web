import { useMemo } from "react";
import { engineConfig } from "#src/engineConfig";
import type { EngineHandlesStatus } from "#src/hooks/engine/useEngineHandles";
import type { TransportStatus } from "#src/hooks/engine/useTransportLoop";
import { useShellT } from "#src/i18n/shell";
import { useErrorText } from "#src/shared/i18n";
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
// Engine and transport errors may come from the shell or from any plugin.
const errorNamespaces = [
  "shell",
  ...[...engineConfig.detection, ...engineConfig.sampling, ...engineConfig.sonification].map(
    (plugin) => plugin.id,
  ),
];

export const EngineStatusAnnouncer = ({ engineStatus, transportStatus }: Props) => {
  const t = useShellT();
  const errorText = useErrorText(errorNamespaces);
  const message = useMemo(() => {
    if (engineStatus === "initializing") {
      return t("status.initializing");
    }
    if (engineStatus instanceof Error) {
      return t("status.engineError", { message: errorText(engineStatus) });
    }
    switch (transportStatus.status) {
      case "running":
        return t("status.running");
      case "error":
        return t("status.transportError", { message: errorText(transportStatus.error) });
      case "stopped":
        return t("status.stopped");
      default:
        return "";
    }
  }, [engineStatus, transportStatus, t, errorText]);

  return <ScreenReaderAnnouncer message={message} politeness="assertive" />;
};
