import { AlertCircle, Pointer } from "lucide-react";
import { useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { useDeviceStore } from "../deviceStore";
import { useErrorText, useT } from "../i18n";

export const MediaPipeNotifications = () => {
  const t = useT();
  const errorText = useErrorText();
  const hasHands = useDeviceStore((s) => s.hasHands);
  const cameraStatus = useDeviceStore((s) => s.cameraStatus);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when a hand is detected again so the prompt can reappear next time
  useEffect(() => {
    if (hasHands === true) setDismissed(false);
  }, [hasHands]);

  if (cameraStatus.status === "error") {
    return (
      <PluginNotification
        message={errorText(cameraStatus.error)}
        icon={AlertCircle}
        politeness="assertive"
      />
    );
  }

  if (hasHands === false && !dismissed) {
    return (
      <PluginNotification
        message={t("notification.handPrompt")}
        icon={Pointer}
        politeness="polite"
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  return null;
};
