import { useCallback, useEffect, useMemo, useState } from "react";

export type AudioOutputDevice = {
  deviceId: string;
  label: string;
};

type MediaDevicesWithOutputSelection = MediaDevices & {
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
};

type EnumeratedAudioOutputs = {
  devices: AudioOutputDevice[];
  inferredDefaultDeviceId: string;
};

type UseAudioOutputDevicesOptions = {
  enabled: boolean;
};

type UseAudioOutputDevicesResult = {
  canSelectOutput: boolean;
  devices: AudioOutputDevice[];
  inferredDefaultDeviceId: string;
  isRequestingOutputAccess: boolean;
  refreshOutputDevices: () => Promise<void>;
  requestOutputAccess: (options?: {
    onSelectDevice?: (deviceId: string) => void;
    desiredDeviceId?: string;
    skipMicrophoneProbe?: boolean;
  }) => Promise<void>;
};

const supportsSinkSelection = (): boolean => {
  if (typeof window === "undefined") return false;

  type SinkableAudioContextCtor = {
    prototype: {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
  };

  const Ctx = window.AudioContext as unknown as SinkableAudioContextCtor | undefined;
  return typeof Ctx?.prototype?.setSinkId === "function";
};

const enumerateAudioOutputs = async (): Promise<EnumeratedAudioOutputs> => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return {
      devices: [],
      inferredDefaultDeviceId: "",
    };
  }

  const allDevices = await navigator.mediaDevices.enumerateDevices();
  const allOutputs = allDevices.filter((device) => device.kind === "audiooutput");
  const defaultPseudo = allOutputs.find((device) => device.deviceId.trim() === "default");

  const seenLabels = new Set<string>();
  const devices = allOutputs
    .filter((device) => {
      const deviceId = device.deviceId.trim();
      if (!deviceId) return false;
      if (deviceId === "default" || deviceId === "communications") return false;
      return true;
    })
    .map((device, index) => {
      const rawLabel = device.label || `Audio output ${index + 1}`;
      const cleanLabel = rawLabel.replace(/^default\s*-\s*/i, "").trim();
      return {
        deviceId: device.deviceId,
        label: cleanLabel || rawLabel,
      };
    })
    .filter((device) => {
      const normalizedLabel = device.label.toLowerCase();
      if (seenLabels.has(normalizedLabel)) return false;
      seenLabels.add(normalizedLabel);
      return true;
    });

  const cleanedDefaultLabel = defaultPseudo?.label?.replace(/^default\s*-\s*/i, "").trim();
  const matchedDefault = cleanedDefaultLabel
    ? devices.find((device) => device.label.toLowerCase() === cleanedDefaultLabel.toLowerCase())
    : undefined;

  return {
    devices,
    inferredDefaultDeviceId: matchedDefault?.deviceId ?? devices[0]?.deviceId ?? "",
  };
};

export const useAudioOutputDevices = ({
  enabled,
}: UseAudioOutputDevicesOptions): UseAudioOutputDevicesResult => {
  const canSelectOutput = useMemo(() => supportsSinkSelection(), []);
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [inferredDefaultDeviceId, setInferredDefaultDeviceId] = useState("");
  const [isRequestingOutputAccess, setIsRequestingOutputAccess] = useState(false);

  const refreshOutputDevices = useCallback(async () => {
    if (!enabled || !canSelectOutput) return;

    try {
      const next = await enumerateAudioOutputs();
      setDevices(next.devices);
      setInferredDefaultDeviceId(next.inferredDefaultDeviceId);
    } catch {
      setDevices([]);
      setInferredDefaultDeviceId("");
    }
  }, [canSelectOutput, enabled]);

  const requestOutputAccess = useCallback(
    async (options?: {
      onSelectDevice?: (deviceId: string) => void;
      desiredDeviceId?: string;
      skipMicrophoneProbe?: boolean;
    }) => {
      if (!enabled || !canSelectOutput) return;
      if (typeof navigator === "undefined") return;

      const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputSelection | undefined;
      if (!mediaDevices) return;

      setIsRequestingOutputAccess(true);
      try {
        if (mediaDevices.selectAudioOutput) {
          const selectedDevice = await mediaDevices.selectAudioOutput(
            options?.desiredDeviceId ? { deviceId: options.desiredDeviceId } : undefined,
          );
          if (selectedDevice.deviceId) {
            options?.onSelectDevice?.(selectedDevice.deviceId);
          }
        }

        if (!options?.skipMicrophoneProbe && mediaDevices.getUserMedia) {
          const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
          stream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        await refreshOutputDevices();
      } catch {
        // User may deny permission or browser may block; keep current list.
      } finally {
        setIsRequestingOutputAccess(false);
      }
    },
    [canSelectOutput, enabled, refreshOutputDevices],
  );

  useEffect(() => {
    if (!enabled || !canSelectOutput) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    void refreshOutputDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshOutputDevices);

    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshOutputDevices);
    };
  }, [canSelectOutput, enabled, refreshOutputDevices]);

  return {
    canSelectOutput,
    devices,
    inferredDefaultDeviceId,
    isRequestingOutputAccess,
    refreshOutputDevices,
    requestOutputAccess,
  };
};
