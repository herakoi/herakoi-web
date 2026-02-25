import { create } from "zustand";
import type { DeviceInfo } from "./NativeCamera";

interface DeviceStoreState {
  // Runtime camera state (not persisted)
  devices: DeviceInfo[];
  deviceId: string;
  mirror: boolean;
  setDevices: (devices: DeviceInfo[]) => void;
  setDeviceId: (deviceId: string) => void;
  setMirror: (mirror: boolean) => void;
  /** Restart the camera (re-triggers getUserMedia). Set by plugin at runtime. */
  restartCamera: (() => Promise<void>) | null;
  setRestartCamera: (fn: (() => Promise<void>) | null) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: [],
  deviceId: "",
  mirror: true,
  setDevices: (devices) => set({ devices }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setMirror: (mirror) => set({ mirror }),
  restartCamera: null,
  setRestartCamera: (fn) => set({ restartCamera: fn }),
}));
