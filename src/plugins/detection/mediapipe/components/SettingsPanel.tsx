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
import styles from "./SettingsPanel.module.css";

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
    <div className={styles.panel}>
      <div className={styles.field}>
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
      <div className={styles.field}>
        <Label htmlFor="camera-device">{t("camera.active")}</Label>
        <div className={styles.deviceRow}>
          {devices.length > 0 ? (
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger
                id="camera-device"
                className={styles.deviceSelect}
                aria-label={t("camera.active")}
              >
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
              <SelectTrigger
                id="camera-device"
                className={styles.deviceSelect}
                aria-label={t("camera.active")}
              >
                <SelectValue placeholder={t("camera.startToSelect")} />
              </SelectTrigger>
              <SelectContent position="popper" />
            </Select>
          )}
          {restartCamera && (
            <Button
              variant="ghost"
              size="icon"
              className={styles.refresh}
              aria-label={t("camera.refresh")}
              onClick={() => void restartCamera()}
            >
              <RefreshCw className={styles.refreshIcon} />
            </Button>
          )}
        </div>
      </div>
      <div className={styles.toggleRow}>
        <Label className={styles.toggleLabel} htmlFor="mirror-toggle">
          {t("settings.mirrorCamera")}
        </Label>
        <Switch id="mirror-toggle" checked={mirror} onCheckedChange={setMirror} />
      </div>
    </div>
  );
};
