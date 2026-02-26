import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_OUTPUT_VALUE = "__default_output__";

type SonificationPanelProps = {
  className?: string;
  style?: React.CSSProperties;
};

type SinkableAudioContextCtor = {
  prototype: {
    setSinkId?: (sinkId: string) => Promise<void>;
  };
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

  useEffect(() => {
    if (!isOscillatorActive) return;
    if (!canSelectOutput) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const refreshDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const outputs = allDevices
          .filter((device) => device.kind === "audiooutput" && device.deviceId.trim().length > 0)
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Audio output ${index + 1}`,
          }));
        setOutputDevices(outputs);
      } catch {
        setOutputDevices([]);
      }
    };

    void refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);

    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshDevices);
    };
  }, [canSelectOutput, isOscillatorActive, setOutputDevices]);

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
              <Select
                value={sinkId || DEFAULT_OUTPUT_VALUE}
                onValueChange={(value) => setSinkId(value === DEFAULT_OUTPUT_VALUE ? "" : value)}
              >
                <SelectTrigger aria-label="Audio output device">
                  <SelectValue placeholder="Select output device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_OUTPUT_VALUE}>System default</SelectItem>
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
