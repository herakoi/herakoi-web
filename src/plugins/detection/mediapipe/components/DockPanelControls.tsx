import { clsx } from "clsx";
import { Camera, RefreshCw, Video, VideoOff } from "lucide-react";
import { Button } from "#src/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import glass from "#src/shared/styles/glass.module.css";
import { useDeviceStore } from "../deviceStore";
import { type t as translate, useErrorText, useT } from "../i18n";
import type { DeviceInfo } from "../NativeCamera";
import styles from "./DockPanelControls.module.css";

type DockPanelControlsProps = {
  pipOpen: boolean;
  deviceId: string | undefined;
  devices: DeviceInfo[];
  cameraEnabled: boolean;
  restartCamera: (() => Promise<void>) | null;
  onTogglePip: () => void;
  onToggleCamera: () => void;
  onDeviceChange: (deviceId: string) => void;
};

function deviceLabel(device: DeviceInfo, t: typeof translate): string {
  if (device.facingMode === "user") return t("camera.front");
  if (device.facingMode === "environment") return t("camera.rear");
  return device.label;
}

export const DockPanelControls = ({
  pipOpen,
  deviceId,
  devices,
  cameraEnabled,
  restartCamera,
  onTogglePip,
  onToggleCamera,
  onDeviceChange,
}: DockPanelControlsProps) => {
  const t = useT();
  const errorText = useErrorText();
  const cameraStatus = useDeviceStore((s) => s.cameraStatus);

  const activeDevice = devices.find((d) => d.deviceId === deviceId) ?? devices[0] ?? null;
  const activePlaceholder = activeDevice ? deviceLabel(activeDevice, t) : t("camera.placeholder");

  return (
    <div className={styles.controls}>
      <div className={styles.row}>
        <Button
          variant="ghost"
          className={clsx(styles.roundButton, glass.button, cameraEnabled && glass.active)}
          aria-pressed={cameraEnabled}
          aria-label={cameraEnabled ? t("camera.disable") : t("camera.enable")}
          onClick={onToggleCamera}
        >
          {cameraEnabled ? <Video className={styles.icon} /> : <VideoOff className={styles.icon} />}
        </Button>
        <Button
          variant="ghost"
          className={clsx(styles.roundButton, glass.button, pipOpen && glass.active)}
          aria-pressed={pipOpen}
          aria-label={pipOpen ? t("pip.hide") : t("pip.show")}
          onClick={onTogglePip}
        >
          <Camera className={styles.icon} />
        </Button>
        {devices.length > 0 ? (
          <Select value={deviceId} onValueChange={onDeviceChange}>
            <SelectTrigger aria-label={t("camera.active")} className={styles.deviceSelect}>
              <span className={styles.deviceName}>
                <SelectValue placeholder={activePlaceholder} />
              </span>
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {deviceLabel(d, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select disabled>
            <SelectTrigger aria-label={t("camera.active")} className={styles.deviceSelect}>
              <span className={styles.deviceName}>
                <SelectValue placeholder={activePlaceholder} />
              </span>
            </SelectTrigger>
            <SelectContent />
          </Select>
        )}
        {restartCamera && (
          <Button
            variant="ghost"
            className={clsx(styles.roundButton, glass.button)}
            aria-label={t("camera.refresh")}
            onClick={() => void restartCamera()}
          >
            <RefreshCw className={styles.smallIcon} />
          </Button>
        )}
      </div>
      {cameraStatus.status === "error" && (
        <p className={styles.error} role="alert">
          {errorText(cameraStatus.error)}
        </p>
      )}
    </div>
  );
};
