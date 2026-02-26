import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { oscillatorSonificationPluginId } from "#src/plugins/sonification/oscillator/config";
import { useOscillatorAudioStore } from "#src/plugins/sonification/oscillator/store";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "#src/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Slider } from "#src/shared/components/ui/slider";
import { cn } from "#src/shared/utils/cn";
import { useActivePlugin } from "#src/state/appConfigStore";

type SonificationPanelProps = {
  className?: string;
  style?: React.CSSProperties;
};

type SinkableAudioContextCtor = {
  prototype: {
    setSinkId?: (sinkId: string) => Promise<void>;
  };
};

type MediaDevicesWithOutputSelection = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

const supportsSinkSelection = (): boolean => {
  if (typeof window === "undefined") return false;
  const Ctx = window.AudioContext as unknown as SinkableAudioContextCtor | undefined;
  return typeof Ctx?.prototype?.setSinkId === "function";
};

export const SonificationPanel = ({ className, style }: SonificationPanelProps) => {
  const [activeSonificationId] = useActivePlugin("sonification");
  const isOscillatorActive = activeSonificationId === oscillatorSonificationPluginId;

  const sinkId = useOscillatorAudioStore((state) => state.sinkId);
  const volume = useOscillatorAudioStore((state) => state.volume);
  const muted = useOscillatorAudioStore((state) => state.muted);
  const outputDevices = useOscillatorAudioStore((state) => state.outputDevices);

  const setSinkId = useOscillatorAudioStore((state) => state.setSinkId);
  const setVolume = useOscillatorAudioStore((state) => state.setVolume);
  const setMuted = useOscillatorAudioStore((state) => state.setMuted);
  const setOutputDevices = useOscillatorAudioStore((state) => state.setOutputDevices);

  const canSelectOutput = useMemo(() => supportsSinkSelection(), []);
  const volumePercent = Math.round(volume * 100);
  const [outputPopoverOpen, setOutputPopoverOpen] = useState(false);
  const [isRequestingOutputAccess, setIsRequestingOutputAccess] = useState(false);
  const [hasAutoRequestedOutputAccess, setHasAutoRequestedOutputAccess] = useState(false);
  const [inferredDefaultDeviceId, setInferredDefaultDeviceId] = useState("");

  const refreshOutputDevices = useCallback(async () => {
    if (!isOscillatorActive) return;
    if (!canSelectOutput) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const allOutputs = allDevices.filter((device) => device.kind === "audiooutput");
      const defaultPseudo = allOutputs.find((device) => device.deviceId.trim() === "default");
      const seenLabels = new Set<string>();
      const outputs = allOutputs
        .filter((device) => {
          const deviceId = device.deviceId.trim();
          if (!deviceId) return false;
          // Hide browser pseudo-devices.
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
      setOutputDevices(outputs);

      const cleanedDefaultLabel = defaultPseudo?.label?.replace(/^default\s*-\s*/i, "").trim();
      const matchedDefault = cleanedDefaultLabel
        ? outputs.find((device) => device.label.toLowerCase() === cleanedDefaultLabel.toLowerCase())
        : undefined;
      setInferredDefaultDeviceId(matchedDefault?.deviceId ?? outputs[0]?.deviceId ?? "");
    } catch {
      setOutputDevices([]);
      setInferredDefaultDeviceId("");
    }
  }, [canSelectOutput, isOscillatorActive, setOutputDevices]);

  const requestOutputAccess = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputSelection | undefined;
    if (!mediaDevices) return;

    setIsRequestingOutputAccess(true);
    try {
      if (mediaDevices.selectAudioOutput) {
        const selectedDevice = await mediaDevices.selectAudioOutput();
        if (selectedDevice.deviceId) {
          setSinkId(selectedDevice.deviceId);
        }
      }

      // Chrome may expose only default output until media permission is granted.
      if (mediaDevices.getUserMedia) {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      await refreshOutputDevices();
    } catch {
      // User may deny permission or browser may block; ignore and keep current list.
    } finally {
      setIsRequestingOutputAccess(false);
    }
  }, [refreshOutputDevices, setSinkId]);

  useEffect(() => {
    if (!isOscillatorActive) return;
    if (!canSelectOutput) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    void refreshOutputDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshOutputDevices);

    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshOutputDevices);
    };
  }, [canSelectOutput, isOscillatorActive, refreshOutputDevices]);

  useEffect(() => {
    if (!outputPopoverOpen) return;
    void refreshOutputDevices();
  }, [outputPopoverOpen, refreshOutputDevices]);

  useEffect(() => {
    if (!outputPopoverOpen) return;
    if (!canSelectOutput) return;
    if (isRequestingOutputAccess) return;
    if (hasAutoRequestedOutputAccess) return;
    if (outputDevices.length > 1) return;

    setHasAutoRequestedOutputAccess(true);
    void requestOutputAccess();
  }, [
    canSelectOutput,
    hasAutoRequestedOutputAccess,
    isRequestingOutputAccess,
    outputDevices.length,
    outputPopoverOpen,
    requestOutputAccess,
  ]);

  useEffect(() => {
    if (!isOscillatorActive) return;
    if (outputDevices.length === 0) return;
    if (sinkId && outputDevices.some((device) => device.deviceId === sinkId)) return;

    const nextDeviceId = inferredDefaultDeviceId || outputDevices[0]?.deviceId;
    if (nextDeviceId) {
      setSinkId(nextDeviceId);
    }
  }, [inferredDefaultDeviceId, isOscillatorActive, outputDevices, setSinkId, sinkId]);

  if (!isOscillatorActive) return null;

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed right-2 top-1/2 z-10 flex h-[248px] w-12 -translate-y-1/2 flex-col items-center gap-3 rounded-full border border-border/60 bg-black/55 py-3 text-card-foreground shadow-card backdrop-blur sm:right-4",
        className,
      )}
      style={style}
      aria-label="Sonification audio controls"
    >
      <Popover open={outputPopoverOpen} onOpenChange={setOutputPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-white/15 bg-black/30 text-white/80 hover:bg-black/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Select audio output device"
            disabled={!canSelectOutput}
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        {canSelectOutput ? (
          <PopoverContent
            side="left"
            align="start"
            sideOffset={10}
            className="w-64 border border-border/60 bg-card/95 p-3 text-card-foreground backdrop-blur"
          >
            <div className="space-y-2">
              <Label>Audio output</Label>
              <Select value={sinkId} onValueChange={(value) => setSinkId(value)}>
                <SelectTrigger aria-label="Audio output device">
                  <SelectValue placeholder="Select output device" />
                </SelectTrigger>
                <SelectContent>
                  {outputDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        ) : null}
      </Popover>

      <div className="flex flex-1 flex-col items-center justify-center">
        <Label className="sr-only">Master volume</Label>
        <div className="h-[150px]">
          <Slider
            orientation="vertical"
            min={0}
            max={100}
            step={1}
            value={[volumePercent]}
            aria-label="Master volume"
            thumbLabels={["Master volume"]}
            onValueChange={([value]) => setVolume(value / 100)}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setMuted(!muted)}
        className={cn(
          "h-8 w-8 rounded-full border border-white/15 bg-black/30 text-white/70 hover:bg-black/50 hover:text-white",
          muted && "border-white/40 text-white",
        )}
        aria-pressed={muted}
        aria-label={muted ? "Unmute sonification" : "Mute sonification"}
      >
        <VolumeX className="h-4 w-4" />
      </Button>
    </aside>
  );
};
