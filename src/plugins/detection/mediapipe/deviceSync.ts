import { useDeviceStore } from "./deviceStore";
import { MediaPipePointDetector } from "./MediaPipePointDetector";

const applyFacingMode = (detector: MediaPipePointDetector, facingMode: string | undefined) => {
  if (facingMode) {
    const shouldMirror = facingMode === "user";
    useDeviceStore.getState().setMirror(shouldMirror);
    detector.setMirror(shouldMirror);
  }
};

const refreshDeviceList = async () => {
  const devices = await MediaPipePointDetector.enumerateDevices();
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
  const restartAndRefresh = async () => {
    useDeviceStore.getState().setCameraError(null);
    try {
      const currentDeviceId = useDeviceStore.getState().deviceId;
      const facingMode = await detector.restartCamera(currentDeviceId);
      await refreshDeviceList();
      applyFacingMode(detector, facingMode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera error";
      useDeviceStore.getState().setCameraError(msg);
    }
  };

  useDeviceStore.getState().setRestartCamera(restartAndRefresh);

  // Enumerate devices on startup and auto-mirror based on active facing mode
  void refreshDeviceList().then(() => {
    applyFacingMode(detector, detector.getActiveFacingMode());
  });

  // Listen for device changes (plug/unplug cameras)
  const deviceChangeHandler = () => void refreshDeviceList();
  navigator.mediaDevices?.addEventListener("devicechange", deviceChangeHandler);

  // Subscribe to deviceStore for mirror and deviceId runtime changes
  const unsubscribeStore = useDeviceStore.subscribe((state, prevState) => {
    if (state.mirror !== prevState.mirror) {
      detector.setMirror(state.mirror);
    }
    if (state.deviceId !== prevState.deviceId) {
      useDeviceStore.getState().setCameraError(null);
      detector
        .restartCamera(state.deviceId)
        .then((facingMode) => {
          applyFacingMode(detector, facingMode);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Camera error";
          useDeviceStore.getState().setCameraError(msg);
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
