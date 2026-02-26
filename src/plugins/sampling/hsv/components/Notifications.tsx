import { Lock, Move } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { useHSVRuntimeStore } from "../runtimeStore";

const instructions =
  "Desktop: drag to pan, wheel to zoom, Shift+wheel to rotate. Mobile: drag with one finger, pinch to zoom/rotate.";

export const HSVNotifications = () => {
  const coverModeActive = useHSVRuntimeStore((state) => state.coverModeActive);
  const panInteractionEnabled = useHSVRuntimeStore((state) => state.panInteractionEnabled);
  const coverModeActivationToken = useHSVRuntimeStore((state) => state.coverModeActivationToken);
  const [dismissedToken, setDismissedToken] = useState<number | null>(null);
  const canShowNotification = coverModeActive && dismissedToken !== coverModeActivationToken;
  const showLockedTip = canShowNotification && !panInteractionEnabled;
  const showInteractionTip = canShowNotification && panInteractionEnabled;

  useEffect(() => {
    if (coverModeActive) {
      setDismissedToken((current) => (current === coverModeActivationToken ? current : null));
    }
  }, [coverModeActive, coverModeActivationToken]);

  if (!canShowNotification) return null;

  return (
    <Fragment>
      {showLockedTip ? (
        <PluginNotification
          icon={Lock}
          message="Tip: unlock image editing, then pan, zoom, and rotate the image."
          screenReaderMessage="Cover mode active. Unlock image editing, then pan, zoom, and rotate the image."
          politeness="polite"
          onDismiss={() => setDismissedToken(coverModeActivationToken)}
        />
      ) : null}
      {showInteractionTip ? (
        <PluginNotification
          icon={Move}
          message={instructions}
          screenReaderMessage={`Cover mode active. ${instructions}`}
          politeness="polite"
          onDismiss={() => setDismissedToken(coverModeActivationToken)}
        />
      ) : null}
    </Fragment>
  );
};
