import { AlertCircle, Pointer } from "lucide-react";
import { useEffect, useState } from "react";
import { PluginNotification } from "#src/shared/components/notifications/PluginNotification";
import { isElectron, openCameraSettings } from "#src/shared/platform/native";
import { useDeviceStore } from "../deviceStore";
import { CameraPermissionDeniedError, type CameraRuntimeError } from "../errors";

/**
 * Resolve the user-facing message for a camera error. The CameraStart/Restart
 * wrappers carry only a static English message; the friendly (Italian) text
 * lives in `.cause`, so we unwrap it here. The permission-denied error already
 * carries its friendly message directly.
 */
function resolveCameraErrorMessage(error: CameraRuntimeError): string {
  if (CameraPermissionDeniedError.is(error)) return error.message;
  if (error.cause instanceof Error) return error.cause.message;
  return error.message;
}

export const MediaPipeNotifications = () => {
  const hasHands = useDeviceStore((s) => s.hasHands);
  const cameraStatus = useDeviceStore((s) => s.cameraStatus);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when a hand is detected again so the prompt can reappear next time
  useEffect(() => {
    if (hasHands === true) setDismissed(false);
  }, [hasHands]);

  if (cameraStatus.status === "error") {
    const { error } = cameraStatus;
    const showSettingsAction = CameraPermissionDeniedError.is(error) && isElectron();
    return (
      <PluginNotification
        message={resolveCameraErrorMessage(error)}
        icon={AlertCircle}
        politeness="assertive"
        action={
          showSettingsAction
            ? { label: "Apri impostazioni", onClick: () => void openCameraSettings() }
            : undefined
        }
      />
    );
  }

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
