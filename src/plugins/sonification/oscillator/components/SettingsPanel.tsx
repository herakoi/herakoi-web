import type { PluginSettingsPanelProps } from "#src/core/plugin";
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

export const OscillatorSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<OscillatorConfig>) => {
  const { minFreq, maxFreq, minVol, maxVol, oscillatorType } = config;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Frequency range ({minFreq}Hz – {maxFreq}Hz)
        </Label>
        <Slider
          min={100}
          max={2000}
          step={10}
          value={[minFreq, maxFreq]}
          aria-label="Frequency range"
          thumbLabels={["Minimum frequency", "Maximum frequency"]}
          onValueChange={([min, max]) => setConfig({ minFreq: min, maxFreq: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Volume range ({Math.round(minVol * 100)}% – {Math.round(maxVol * 100)}%)
        </Label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[minVol * 100, maxVol * 100]}
          aria-label="Volume range"
          thumbLabels={["Minimum volume", "Maximum volume"]}
          onValueChange={([min, max]) => setConfig({ minVol: min / 100, maxVol: max / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>Waveform</Label>
        <Select
          value={oscillatorType}
          onValueChange={(value) => setConfig({ oscillatorType: value as OscillatorType })}
        >
          <SelectTrigger aria-label="Oscillator waveform">
            <SelectValue placeholder="Waveform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sine">Sine</SelectItem>
            <SelectItem value="triangle">Triangle</SelectItem>
            <SelectItem value="sawtooth">Sawtooth</SelectItem>
            <SelectItem value="square">Square</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
