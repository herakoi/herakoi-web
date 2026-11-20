import { AlertCircle, Check, Pointer, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { useErrorText, useT } from "../i18n";
import { useWallStore } from "../store";

export const WallNotifications = () => {
  const t = useT();
  const errorText = useErrorText();
  const mapping = useWallStore((s) => s.mapping);
  const mapped = useWallStore((s) => s.mapped);
  const layoutChanged = useWallStore((s) => s.layoutChanged);
  const hasHands = useWallStore((s) => s.hasHands);
  const cameraError = useWallStore((s) => s.cameraError);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (hasHands === true) setDismissed(false);
  }, [hasHands]);

  useEffect(() => {
    if (mapping.status !== "done" && mapping.status !== "error") return;
    const timeout = setTimeout(
      () => useWallStore.getState().setMapping({ status: "idle" }),
      mapping.status === "done" ? 2500 : 8000,
    );
    return () => clearTimeout(timeout);
  }, [mapping.status]);

  if (cameraError) {
    return (
      <PluginNotification
        message={errorText(cameraError)}
        icon={AlertCircle}
        politeness="assertive"
      />
    );
  }
  if (mapping.status === "running") {
    return <PluginNotification message={t(`progress.${mapping.step}`)} icon={ScanLine} />;
  }
  if (mapping.status === "error") {
    return (
      <PluginNotification
        message={t("notification.failed", { reason: errorText(mapping.error) })}
        icon={AlertCircle}
        politeness="assertive"
      />
    );
  }
  if (mapping.status === "done") {
    return <PluginNotification message={t("notification.done")} icon={Check} />;
  }
  if (hasHands === null) return null;
  if (layoutChanged) {
    return <PluginNotification message={t("notification.layoutChanged")} icon={ScanLine} />;
  }
  if (!mapped) {
    return <PluginNotification message={t("notification.unmapped")} icon={ScanLine} />;
  }
  if (hasHands === false && !dismissed) {
    return (
      <PluginNotification
        message={t("notification.prompt")}
        icon={Pointer}
        onDismiss={() => setDismissed(true)}
      />
    );
  }
  return null;
};
