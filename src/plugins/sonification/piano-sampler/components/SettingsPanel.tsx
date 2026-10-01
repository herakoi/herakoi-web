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
import { defaultPianoSamplerConfig, type PianoSamplerConfig } from "../config";
import { PIANO_SCALE_LABELS, PIANO_SCALES, type PianoScale } from "../scale";
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
  // Configs persisted before these settings existed lack their keys.
  const scale = config.scale ?? defaultPianoSamplerConfig.scale;
  const hysteresis = config.hysteresis ?? defaultPianoSamplerConfig.hysteresis;
  const minIntervalMs = config.minIntervalMs ?? defaultPianoSamplerConfig.minIntervalMs;
  const sinkId = usePianoSamplerAudioStore((state) => state.sinkId);
  const setSinkId = usePianoSamplerAudioStore((state) => state.setSinkId);

  return (
    <div className="space-y-4">
      <AudioOutputSelector value={sinkId} onValueChange={setSinkId} mode="inline" />
      <div className="space-y-2">
        <Label>
          MIDI note range ({midiToNoteName(noteMin)} – {midiToNoteName(noteMax)})
        </Label>
        <Slider
          min={21}
          max={108}
          step={1}
          value={[noteMin, noteMax]}
          aria-label="MIDI note range"
          thumbLabels={["Minimum note", "Maximum note"]}
          onValueChange={([min, max]) => setConfig({ noteMin: min, noteMax: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>Scale</Label>
        <Select value={scale} onValueChange={(value) => setConfig({ scale: value as PianoScale })}>
          <SelectTrigger aria-label="Scale">
            <SelectValue placeholder="Scale" />
          </SelectTrigger>
          <SelectContent>
            {PIANO_SCALES.map((s) => (
              <SelectItem key={s} value={s}>
                {PIANO_SCALE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Note change threshold ({Math.round(hysteresis * 100)}%)</Label>
        <Slider
          min={0}
          max={45}
          step={5}
          value={[Math.round(hysteresis * 100)]}
          aria-label="Note change threshold"
          thumbLabels={["Note change threshold"]}
          onValueChange={([percent]) => setConfig({ hysteresis: percent / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>Minimum time between notes ({minIntervalMs} ms)</Label>
        <Slider
          min={0}
          max={500}
          step={10}
          value={[minIntervalMs]}
          aria-label="Minimum time between notes"
          thumbLabels={["Minimum time between notes"]}
          onValueChange={([ms]) => setConfig({ minIntervalMs: ms })}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Velocity range ({velocityMin} – {velocityMax})
        </Label>
        <Slider
          min={0}
          max={127}
          step={1}
          value={[velocityMin, velocityMax]}
          aria-label="Velocity range"
          thumbLabels={["Minimum velocity", "Maximum velocity"]}
          onValueChange={([min, max]) => setConfig({ velocityMin: min, velocityMax: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>Note duration</Label>
        <Select value={noteDuration} onValueChange={(value) => setConfig({ noteDuration: value })}>
          <SelectTrigger aria-label="Note duration">
            <SelectValue placeholder="Duration" />
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
