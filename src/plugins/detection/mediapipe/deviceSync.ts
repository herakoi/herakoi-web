import { CameraRestartError, DeviceEnumerationError } from "#src/core/domain-errors";
import type { ErrorOr } from "#src/core/interfaces";
import { useDeviceStore } from "./deviceStore";
import { MediaPipePointDetector } from "./MediaPipePointDetector";

const applyFacingMode = (detector: MediaPipePointDetector, facingMode: string | undefined) => {
  if (facingMode) {
    const shouldMirror = facingMode === "user";
    useDeviceStore.getState().setMirror(shouldMirror);
    detector.setMirror(shouldMirror);
  }
};

const asError = (error: unknown, fallbackMessage = "Camera error") =>
  error instanceof Error ? error : new Error(fallbackMessage);

const refreshDeviceList = async (): Promise<ErrorOr<undefined>> => {
  const devices = await MediaPipePointDetector.enumerateDevices().catch((error: unknown) =>
    asError(error, "Unable to enumerate camera devices."),
  );
  if (devices instanceof Error) {
    return devices;
  }
  useDeviceStore.getState().setDevices(devices);
  const { deviceId } = useDeviceStore.getState();
  if (deviceId && !devices.some((d) => d.deviceId === deviceId)) {
    useDeviceStore.getState().setDeviceId(undefined);
  }
};

/**
 * Binds all device-management side-effects for the MediaPipe plugin:
 * initial device enumeration, devicechange listener, store subscription,
 * and the restartCamera callback used by the UI.
 *
 * Returns a cleanup function that tears everything down.
 */
export function bindDeviceSync(detector: MediaPipePointDetector): () => void {
  const restartAndRefresh = async (): Promise<void> => {
    useDeviceStore.getState().setCameraOk();
    const currentDeviceId = useDeviceStore.getState().deviceId;
    const restartResult = await detector.restartCamera(currentDeviceId);
    if (restartResult instanceof Error) {
      useDeviceStore.getState().setCameraError(new CameraRestartError({ cause: restartResult }));
      return;
    }

    const refreshResult = await refreshDeviceList();
    if (refreshResult instanceof Error) {
      useDeviceStore
        .getState()
        .setCameraError(new DeviceEnumerationError({ cause: refreshResult }));
      return;
    }

    applyFacingMode(detector, restartResult);
  };

  useDeviceStore.getState().setRestartCamera(restartAndRefresh);

  // Enumerate devices on startup and auto-mirror based on active facing mode
  void refreshDeviceList().then((refreshResult) => {
    if (refreshResult instanceof Error) {
      useDeviceStore
        .getState()
        .setCameraError(new DeviceEnumerationError({ cause: refreshResult }));
      return;
    }
    applyFacingMode(detector, detector.getActiveFacingMode());
  });

  // Listen for device changes (plug/unplug cameras)
  const deviceChangeHandler = () => {
    void refreshDeviceList().then((refreshResult) => {
      if (refreshResult instanceof Error) {
        useDeviceStore
          .getState()
          .setCameraError(new DeviceEnumerationError({ cause: refreshResult }));
      }
    });
  };
  navigator.mediaDevices?.addEventListener("devicechange", deviceChangeHandler);

  // Subscribe to deviceStore for mirror and deviceId runtime changes
  const unsubscribeStore = useDeviceStore.subscribe((state, prevState) => {
    if (state.mirror !== prevState.mirror) {
      detector.setMirror(state.mirror);
    }
    if (state.deviceId !== prevState.deviceId) {
      useDeviceStore.getState().setCameraOk();
      void detector.restartCamera(state.deviceId).then((restartResult) => {
        if (restartResult instanceof Error) {
          useDeviceStore
            .getState()
            .setCameraError(new CameraRestartError({ cause: restartResult }));
          return;
        }

        applyFacingMode(detector, restartResult);
      });
    }
  });

  return () => {
    navigator.mediaDevices?.removeEventListener("devicechange", deviceChangeHandler);
    unsubscribeStore();
    useDeviceStore.getState().setRestartCamera(null);
    useDeviceStore.getState().setDevices([]);
  };
}
