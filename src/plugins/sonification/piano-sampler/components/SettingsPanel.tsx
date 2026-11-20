import { Frequency } from "tone";
import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { RestBehaviorSelect } from "#src/plugins/sonification/shared/RestBehaviorSelect";
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
import utilities from "#src/shared/styles/utilities.module.css";
import type { PianoSamplerConfig } from "../config";
import { useT } from "../i18n";
import type { PianoPlayMode } from "../PianoSamplerSonifier";
import { usePianoSamplerAudioStore } from "../store";

const NOTE_DURATIONS = ["32n", "16n", "8n", "4n", "2n", "1n", "0.5"] as const;

function midiToNoteName(midi: number): string {
  return Frequency(midi, "midi").toNote();
}

export const PianoSamplerSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<PianoSamplerConfig>) => {
  const {
    noteMin,
    noteMax,
    velocityMin,
    velocityMax,
    noteDuration,
    playMode,
    motionStep,
    minNotesPerSecond,
    maxNotesPerSecond,
  } = config;
  const sinkId = usePianoSamplerAudioStore((state) => state.sinkId);
  const setSinkId = usePianoSamplerAudioStore((state) => state.setSinkId);
  const t = useT();

  return (
    <div className={utilities.stack4}>
      <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="inline" />
      <div className={utilities.stack2}>
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
      <div className={utilities.stack2}>
        <Label>{t("playMode.label")}</Label>
        <Select
          value={playMode}
          onValueChange={(value) => setConfig({ playMode: value as PianoPlayMode })}
        >
          <SelectTrigger aria-label={t("playMode.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="motion">{t("playMode.motion")}</SelectItem>
            <SelectItem value="change">{t("playMode.change")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {playMode === "motion" ? (
        <RestBehaviorSelect
          value={config.restBehavior}
          onValueChange={(restBehavior) => setConfig({ restBehavior })}
        />
      ) : null}
      {playMode === "motion" ? (
        <>
          <div className={utilities.stack2}>
            <Label>{t("minRate.label", { rate: minNotesPerSecond })}</Label>
            <Slider
              min={0}
              max={8}
              step={0.5}
              value={[minNotesPerSecond]}
              aria-label={t("minRate.aria")}
              onValueChange={([rate]) => setConfig({ minNotesPerSecond: rate })}
            />
          </div>
          <div className={utilities.stack2}>
            <Label>{t("motionStep.label", { percent: Math.round(motionStep * 100) })}</Label>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[Math.round(motionStep * 100)]}
              aria-label={t("motionStep.aria")}
              onValueChange={([percent]) => setConfig({ motionStep: percent / 100 })}
            />
          </div>
          <div className={utilities.stack2}>
            <Label>{t("maxRate.label", { rate: maxNotesPerSecond })}</Label>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[maxNotesPerSecond]}
              aria-label={t("maxRate.aria")}
              onValueChange={([rate]) => setConfig({ maxNotesPerSecond: rate })}
            />
          </div>
        </>
      ) : null}
      <div className={utilities.stack2}>
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
      <div className={utilities.stack2}>
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
