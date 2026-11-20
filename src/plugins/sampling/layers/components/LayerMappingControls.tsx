import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import type { ImageEntry } from "#src/shared/image/types";
import type { LayerColorMode, LayerMapping, LayerStretch, LayersSamplingConfig } from "../config";
import { useT } from "../i18n";
import { rgbLayerNames } from "../lib/cube";
import { NO_LAYER, sanitizeLayerMapping } from "../lib/render";
import styles from "./LayerMappingControls.module.css";

type LayerMappingControlsProps = {
  entry: ImageEntry;
  config: LayersSamplingConfig;
  setConfig: (updates: Partial<LayersSamplingConfig>) => void;
};

const stretches: LayerStretch[] = ["linear", "sqrt", "log", "asinh"];

const channelKeys = {
  rgb: ["layers.channel.r", "layers.channel.g", "layers.channel.b"],
  hsv: ["layers.channel.h", "layers.channel.s", "layers.channel.v"],
} as const;

/** Which layer feeds each colour channel of the image, and the stretch. */
export const LayerMappingControls = ({ entry, config, setConfig }: LayerMappingControlsProps) => {
  const t = useT();
  const layers = entry.layers ?? rgbLayerNames;
  const mapping = sanitizeLayerMapping(config.mappings?.[entry.id], layers.length);

  const update = (updates: Partial<LayerMapping>) => {
    setConfig({ mappings: { ...config.mappings, [entry.id]: { ...mapping, ...updates } } });
  };

  const setChannel = (channel: 0 | 1 | 2, layer: number) => {
    const channels: LayerMapping["channels"] = [...mapping.channels];
    channels[channel] = layer;
    update({ channels });
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t("layers.title")}</legend>
      <div className={styles.row}>
        <Label className={styles.label}>{t("layers.mode")}</Label>
        <Select
          value={mapping.mode}
          onValueChange={(value) => update({ mode: value as LayerColorMode })}
        >
          <SelectTrigger aria-label={t("layers.mode")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rgb">{t("layers.mode.rgb")}</SelectItem>
            <SelectItem value="hsv">{t("layers.mode.hsv")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {([0, 1, 2] as const).map((channel) => {
        const label = t(channelKeys[mapping.mode][channel]);
        return (
          <div key={channel} className={styles.row}>
            <Label className={styles.label}>{label}</Label>
            <Select
              value={String(mapping.channels[channel])}
              onValueChange={(value) => setChannel(channel, Number(value))}
            >
              <SelectTrigger aria-label={t("layers.channelLayer", { channel: label })}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(NO_LAYER)}>{t("layers.none")}</SelectItem>
                {layers.map((name, index) => (
                  <SelectItem key={`${index}-${name}`} value={String(index)}>
                    {`${index + 1}. ${name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <div className={styles.row}>
        <Label className={styles.label}>{t("layers.stretch")}</Label>
        <Select
          value={mapping.stretch}
          onValueChange={(value) => update({ stretch: value as LayerStretch })}
        >
          <SelectTrigger aria-label={t("layers.stretch")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stretches.map((stretch) => (
              <SelectItem key={stretch} value={stretch}>
                {t(`layers.stretch.${stretch}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className={styles.hint}>{t("layers.hint")}</p>
    </fieldset>
  );
};
