import { RefreshCw } from "lucide-react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Slider } from "#src/shared/components/ui/slider";
import { Switch } from "#src/shared/components/ui/switch";
import type { MediaPipeConfig } from "../config";
import { useDeviceStore } from "../deviceStore";
import { type t as translate, useT } from "../i18n";

function deviceLabel(device: { label: string; facingMode?: string }, t: typeof translate): string {
  if (device.facingMode === "user") return t("camera.front");
  if (device.facingMode === "environment") return t("camera.rear");
  return device.label;
}

export const MediaPipeSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<MediaPipeConfig>) => {
  const t = useT();
  const devices = useDeviceStore((s) => s.devices);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const mirror = useDeviceStore((s) => s.mirror);
  const setDeviceId = useDeviceStore((s) => s.setDeviceId);
  const setMirror = useDeviceStore((s) => s.setMirror);
  const restartCamera = useDeviceStore((s) => s.restartCamera);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-hands">
          {t("settings.trackedHandsCount", { hands: config.maxHands })}
        </Label>
        <Slider
          id="max-hands"
          min={1}
          max={4}
          step={1}
          value={[config.maxHands]}
          aria-label={t("settings.trackedHands")}
          onValueChange={([value]) => setConfig({ maxHands: value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="camera-device">{t("camera.active")}</Label>
        <div className="flex items-center gap-1.5">
          {devices.length > 0 ? (
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger id="camera-device" className="flex-1" aria-label={t("camera.active")}>
                <SelectValue placeholder={t("camera.default")} />
              </SelectTrigger>
              <SelectContent position="popper">
                {devices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {deviceLabel(d, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select disabled>
              <SelectTrigger id="camera-device" className="flex-1" aria-label={t("camera.active")}>
                <SelectValue placeholder={t("camera.startToSelect")} />
              </SelectTrigger>
              <SelectContent position="popper" />
            </Select>
          )}
          {restartCamera && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label={t("camera.refresh")}
              onClick={() => void restartCamera()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium" htmlFor="mirror-toggle">
          {t("settings.mirrorCamera")}
        </Label>
        <Switch id="mirror-toggle" checked={mirror} onCheckedChange={setMirror} />
      </div>
    </div>
  );
};
