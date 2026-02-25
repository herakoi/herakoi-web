import { Pointer } from "lucide-react";
import { useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { useDeviceStore } from "../deviceStore";

export const MediaPipeNotifications = () => {
  const hasHands = useDeviceStore((s) => s.hasHands);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when a hand is detected again so the prompt can reappear next time
  useEffect(() => {
    if (hasHands === true) setDismissed(false);
  }, [hasHands]);

  if (hasHands === false && !dismissed) {
    return (
      <PluginNotification
        message="Move your index finger in front of the camera to play"
        icon={Pointer}
        politeness="polite"
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  return null;
};
