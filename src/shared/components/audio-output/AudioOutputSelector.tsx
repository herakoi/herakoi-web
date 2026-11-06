import { clsx } from "clsx";
import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { useCommonT } from "#src/shared/i18n/common";
import styles from "./AudioOutputSelector.module.css";
import controls from "./audioControls.module.css";

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
  label,
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

  const t = useCommonT();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [hasAutoRequestedOutputAccess, setHasAutoRequestedOutputAccess] = useState(false);
  const followSystemDefaultRef = useRef(true);
  const previousInferredDefaultRef = useRef("");

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

    const inferredDefaultChanged =
      Boolean(previousInferredDefaultRef.current) &&
      Boolean(inferredDefaultDeviceId) &&
      previousInferredDefaultRef.current !== inferredDefaultDeviceId;
    previousInferredDefaultRef.current = inferredDefaultDeviceId;

    const hasCurrent = value && devices.some((device) => device.deviceId === value);
    if (hasCurrent) {
      if (
        followSystemDefaultRef.current &&
        inferredDefaultChanged &&
        value !== inferredDefaultDeviceId
      ) {
        onValueChange(inferredDefaultDeviceId);
      }
      return;
    }

    // On startup (empty value) or after device removal, pick the effective default.
    const fallbackDeviceId = inferredDefaultDeviceId || devices[0]?.deviceId || "";
    if (!fallbackDeviceId) return;
    if (value !== fallbackDeviceId) {
      followSystemDefaultRef.current = true;
      onValueChange(fallbackDeviceId);
    }
  }, [devices, inferredDefaultDeviceId, onValueChange, value]);

  const handleDeviceChange = (deviceId: string) => {
    followSystemDefaultRef.current = false;
    onValueChange(deviceId);
    void requestOutputAccess({
      desiredDeviceId: deviceId,
      onSelectDevice: onValueChange,
      skipMicrophoneProbe: true,
    });
  };

  const selector = (
    <div className={clsx(styles.selector, className)}>
      <Label>{label ?? t("audioOutput.label")}</Label>
      <Select value={value} onValueChange={handleDeviceChange}>
        <SelectTrigger aria-label={t("audioOutput.device")} disabled={!canSelectOutput}>
          <SelectValue placeholder={t("audioOutput.placeholder")} />
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
          className={styles.trigger}
          aria-label={t("audioOutput.open")}
          disabled={!canSelectOutput}
        >
          <Volume2 className={controls.icon} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={10} className={styles.popover}>
        {selector}
      </PopoverContent>
    </Popover>
  );
};
