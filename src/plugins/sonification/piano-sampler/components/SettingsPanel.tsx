import { Frequency } from "tone";
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
import type { PianoSamplerConfig } from "../config";
import { useT } from "../i18n";
import { usePianoSamplerAudioStore } from "../store";

const NOTE_DURATIONS = ["32n", "16n", "8n", "4n", "2n", "1n", "0.5"] as const;

function midiToNoteName(midi: number): string {
  return Frequency(midi, "midi").toNote();
}

export const PianoSamplerSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<PianoSamplerConfig>) => {
  const { noteMin, noteMax, velocityMin, velocityMax, noteDuration } = config;
  const sinkId = usePianoSamplerAudioStore((state) => state.sinkId);
  const setSinkId = usePianoSamplerAudioStore((state) => state.setSinkId);
  const t = useT();

  return (
    <div className="space-y-4">
      <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="inline" />
      <div className="space-y-2">
        <Label>
          {t("noteRange.label", { min: midiToNoteName(noteMin), max: midiToNoteName(noteMax) })}
        </Label>
        <Slider
          min={21}
          max={108}
          step={1}
          value={[noteMin, noteMax]}
          aria-label={t("noteRange.aria")}
          thumbLabels={[t("noteRange.min"), t("noteRange.max")]}
          onValueChange={([min, max]) => setConfig({ noteMin: min, noteMax: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("velocityRange.label", { min: velocityMin, max: velocityMax })}</Label>
        <Slider
          min={0}
          max={127}
          step={1}
          value={[velocityMin, velocityMax]}
          aria-label={t("velocityRange.aria")}
          thumbLabels={[t("velocityRange.min"), t("velocityRange.max")]}
          onValueChange={([min, max]) => setConfig({ velocityMin: min, velocityMax: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("noteDuration.label")}</Label>
        <Select value={noteDuration} onValueChange={(value) => setConfig({ noteDuration: value })}>
          <SelectTrigger aria-label={t("noteDuration.label")}>
            <SelectValue placeholder={t("noteDuration.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {NOTE_DURATIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
