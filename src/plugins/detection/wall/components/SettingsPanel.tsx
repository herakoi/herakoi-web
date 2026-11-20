import { ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { type DeviceInfo, NativeCamera } from "#src/plugins/detection/mediapipe/NativeCamera";
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
import type { WallConfig } from "../config";
import { useT } from "../i18n";
import type { HandSide, PlayTarget } from "../lib/tracker";
import { useWallStore } from "../store";
import styles from "./SettingsPanel.module.css";
import { useStartMapping } from "./useStartMapping";

const DEFAULT_DEVICE = "default";

export const WallSettingsPanel = ({ config, setConfig }: PluginSettingsPanelProps<WallConfig>) => {
  const t = useT();
  const { start, disabled } = useStartMapping();
  const running = useWallStore((s) => s.runMapping !== null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    void NativeCamera.enumerateVideoDevices().then(setDevices);
  }, []);

  const calibration = config.calibration;
  const status = !calibration
    ? running
      ? t("map.none")
      : t("map.notRunning")
    : calibration.errorPx === null
      ? t("map.summaryCoarse")
      : t("map.summary", {
          matched: calibration.matchedDots,
          total: calibration.totalDots,
          error: calibration.errorPx.toFixed(1),
        });

  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        <div className={styles.buttons}>
          <Button size="sm" onClick={start} disabled={disabled}>
            <ScanLine className={styles.icon} />
            {calibration ? t("map.again") : t("map.start")}
          </Button>
          {calibration ? (
            <Button size="sm" variant="ghost" onClick={() => setConfig({ calibration: null })}>
              {t("map.clear")}
            </Button>
          ) : null}
        </div>
        <p className={styles.status}>{status}</p>
      </div>
      <div className={styles.field}>
        <Label htmlFor="wall-hand">{t("settings.hand")}</Label>
        <Select value={config.hand} onValueChange={(hand) => setConfig({ hand: hand as HandSide })}>
          <SelectTrigger id="wall-hand" aria-label={t("settings.hand")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="right">{t("settings.hand.right")}</SelectItem>
            <SelectItem value="left">{t("settings.hand.left")}</SelectItem>
            <SelectItem value="both">{t("settings.hand.both")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={styles.field}>
        <Label htmlFor="wall-play-with">{t("settings.playWith")}</Label>
        <Select
          value={config.playWith ?? "palm"}
          onValueChange={(playWith) => setConfig({ playWith: playWith as PlayTarget })}
        >
          <SelectTrigger id="wall-play-with" aria-label={t("settings.playWith")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="palm">{t("settings.playWith.palm")}</SelectItem>
            <SelectItem value="fingertip">{t("settings.playWith.fingertip")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={styles.field}>
        <Label htmlFor="wall-people">{t("settings.people", { people: config.maxPeople })}</Label>
        <Slider
          id="wall-people"
          min={1}
          max={4}
          step={1}
          value={[config.maxPeople]}
          aria-label={t("settings.peopleLabel")}
          onValueChange={([value]) => setConfig({ maxPeople: value })}
        />
      </div>
      <div className={styles.field}>
        <Label htmlFor="wall-camera">{t("settings.camera")}</Label>
        <Select
          value={config.deviceId || DEFAULT_DEVICE}
          onValueChange={(value) => setConfig({ deviceId: value === DEFAULT_DEVICE ? "" : value })}
        >
          <SelectTrigger id="wall-camera" aria-label={t("settings.camera")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={DEFAULT_DEVICE}>{t("settings.cameraDefault")}</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={styles.toggleRow}>
        <Label className={styles.toggleLabel} htmlFor="wall-preview">
          {t("settings.preview")}
        </Label>
        <Switch
          id="wall-preview"
          checked={config.showPreview}
          onCheckedChange={(showPreview) => setConfig({ showPreview })}
        />
      </div>
    </div>
  );
};
