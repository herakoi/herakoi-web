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
