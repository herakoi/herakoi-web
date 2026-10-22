import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { AudioOutputSelector } from "#src/shared/components/audio-output/AudioOutputSelector";
import { Label } from "#src/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/shared/components/ui/select";
import { Slider } from "#src/shared/components/ui/slider";
import type { OscillatorConfig } from "../config";
import { useT } from "../i18n";
import { useOscillatorAudioStore } from "../store";

export const OscillatorSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<OscillatorConfig>) => {
  const { minFreq, maxFreq, minVol, maxVol, oscillatorType } = config;
  const sinkId = useOscillatorAudioStore((state) => state.sinkId);
  const setSinkId = useOscillatorAudioStore((state) => state.setSinkId);
  const t = useT();

  return (
    <div className="space-y-4">
      <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="inline" />
      <div className="space-y-2">
        <Label>{t("frequencyRange.label", { min: minFreq, max: maxFreq })}</Label>
        <Slider
          min={100}
          max={2000}
          step={10}
          value={[minFreq, maxFreq]}
          aria-label={t("frequencyRange.aria")}
          thumbLabels={[t("frequencyRange.min"), t("frequencyRange.max")]}
          onValueChange={([min, max]) => setConfig({ minFreq: min, maxFreq: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>
          {t("volumeRange.label", {
            min: Math.round(minVol * 100),
            max: Math.round(maxVol * 100),
          })}
        </Label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[minVol * 100, maxVol * 100]}
          aria-label={t("volumeRange.aria")}
          thumbLabels={[t("volumeRange.min"), t("volumeRange.max")]}
          onValueChange={([min, max]) => setConfig({ minVol: min / 100, maxVol: max / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("waveform.label")}</Label>
        <Select
          value={oscillatorType}
          onValueChange={(value) => setConfig({ oscillatorType: value as OscillatorType })}
        >
          <SelectTrigger aria-label={t("waveform.aria")}>
            <SelectValue placeholder={t("waveform.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sine">{t("waveform.sine")}</SelectItem>
            <SelectItem value="triangle">{t("waveform.triangle")}</SelectItem>
            <SelectItem value="sawtooth">{t("waveform.sawtooth")}</SelectItem>
            <SelectItem value="square">{t("waveform.square")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
