import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useAudioOutputDevices } from "#src/shared/hooks/useAudioOutputDevices";
import { cn } from "#src/shared/utils/cn";

type AudioOutputSelectorMode = "icon-popover" | "inline";

type AudioOutputSelectorProps = {
  value: string;
  onValueChange: (deviceId: string) => void;
  mode?: AudioOutputSelectorMode;
  label?: string;
  className?: string;
};

export const AudioOutputSelector = ({
  value,
  onValueChange,
  mode = "icon-popover",
  label = "Audio output",
  className,
}: AudioOutputSelectorProps) => {
  const {
    canSelectOutput,
    devices,
    inferredDefaultDeviceId,
    isRequestingOutputAccess,
    refreshOutputDevices,
    requestOutputAccess,
  } = useAudioOutputDevices({ enabled: true });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [hasAutoRequestedOutputAccess, setHasAutoRequestedOutputAccess] = useState(false);

  const open = mode === "inline" ? true : popoverOpen;

  useEffect(() => {
    if (!open) return;
    void refreshOutputDevices();
  }, [open, refreshOutputDevices]);

  useEffect(() => {
    if (!open) return;
    if (!canSelectOutput) return;
    if (isRequestingOutputAccess) return;
    if (hasAutoRequestedOutputAccess) return;
    if (devices.length > 1) return;

    setHasAutoRequestedOutputAccess(true);
    void requestOutputAccess({ onSelectDevice: onValueChange });
  }, [
    canSelectOutput,
    devices.length,
    hasAutoRequestedOutputAccess,
    isRequestingOutputAccess,
    onValueChange,
    open,
    requestOutputAccess,
  ]);

  useEffect(() => {
    if (devices.length === 0) return;
    if (value && devices.some((device) => device.deviceId === value)) return;

    const fallbackDeviceId = inferredDefaultDeviceId || devices[0]?.deviceId;
    if (fallbackDeviceId) {
      onValueChange(fallbackDeviceId);
    }
  }, [devices, inferredDefaultDeviceId, onValueChange, value]);

  const handleDeviceChange = (deviceId: string) => {
    onValueChange(deviceId);
    void requestOutputAccess({
      desiredDeviceId: deviceId,
      onSelectDevice: onValueChange,
      skipMicrophoneProbe: true,
    });
  };

  const selector = (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={handleDeviceChange}>
        <SelectTrigger aria-label="Audio output device" disabled={!canSelectOutput}>
          <SelectValue placeholder="Select output device" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (mode === "inline") {
    return selector;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
      <PopoverContent
        side="left"
        align="start"
        sideOffset={10}
        className="w-64 border border-border/60 bg-card/95 p-3 text-card-foreground backdrop-blur"
      >
        {selector}
      </PopoverContent>
    </Popover>
  );
};
