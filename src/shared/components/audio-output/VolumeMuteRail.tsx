import { clsx } from "clsx";
import { VolumeX } from "lucide-react";
import { Button } from "#src/shared/components/ui/button";
import { Label } from "#src/shared/components/ui/label";
import { Slider } from "#src/shared/components/ui/slider";
import { useCommonT } from "#src/shared/i18n/common";
import utilities from "#src/shared/styles/utilities.module.css";
import controls from "./audioControls.module.css";
import styles from "./VolumeMuteRail.module.css";

type VolumeMuteRailProps = {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  className?: string;
};

export const VolumeMuteRail = ({
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
  className,
}: VolumeMuteRailProps) => {
  const t = useCommonT();
  const volumePercent = Math.round(volume * 100);

  return (
    <div className={clsx(styles.rail, className)}>
      <div className={styles.sliderArea}>
        <Label className={utilities.srOnly}>{t("volume.master")}</Label>
        <div className={styles.slider}>
          <Slider
            orientation="vertical"
            min={0}
            max={100}
            step={1}
            value={[volumePercent]}
            aria-label={t("volume.master")}
            thumbLabels={[t("volume.master")]}
            onValueChange={([value]) => onVolumeChange(value / 100)}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onMutedChange(!muted)}
        className={clsx(styles.mute, muted && styles.muted)}
        aria-pressed={muted}
        aria-label={t("volume.mute")}
      >
        <VolumeX className={controls.icon} />
      </Button>
    </div>
  );
};
