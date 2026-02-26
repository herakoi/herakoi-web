import { Move } from "lucide-react";
import { useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { useHSVRuntimeStore } from "../runtimeStore";

const instructions =
  "Desktop: drag to pan, wheel to zoom, Shift+wheel to rotate. Mobile: drag with one finger, pinch to zoom/rotate.";

export const HSVNotifications = () => {
  const coverModeActive = useHSVRuntimeStore((state) => state.coverModeActive);
  const coverModeActivationToken = useHSVRuntimeStore((state) => state.coverModeActivationToken);
  const [dismissedToken, setDismissedToken] = useState<number | null>(null);

  useEffect(() => {
    if (coverModeActive) {
      setDismissedToken((current) => (current === coverModeActivationToken ? current : null));
    }
  }, [coverModeActive, coverModeActivationToken]);

  if (!coverModeActive || dismissedToken === coverModeActivationToken) return null;

  return (
    <PluginNotification
      icon={Move}
      message={instructions}
      screenReaderMessage={`Cover mode attiva. ${instructions}`}
      politeness="polite"
      onDismiss={() => setDismissedToken(coverModeActivationToken)}
    />
  );
};
