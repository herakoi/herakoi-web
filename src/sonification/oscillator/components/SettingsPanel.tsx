import { Label } from "#src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#src/app/components/ui/select";
import { Slider } from "#src/app/components/ui/slider";
import { useOscillatorSonificationStore } from "../store";

export const OscillatorSettingsPanel = () => {
  const minFreq = useOscillatorSonificationStore((state) => state.minFreq);
  const maxFreq = useOscillatorSonificationStore((state) => state.maxFreq);
  const minVol = useOscillatorSonificationStore((state) => state.minVol);
  const maxVol = useOscillatorSonificationStore((state) => state.maxVol);
  const oscillatorType = useOscillatorSonificationStore((state) => state.oscillatorType);
  const setSettings = useOscillatorSonificationStore((state) => state.setSettings);

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
          onValueChange={([min, max]) => setSettings({ minFreq: min, maxFreq: max })}
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
          onValueChange={([min, max]) => setSettings({ minVol: min / 100, maxVol: max / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>Waveform</Label>
        <Select
          value={oscillatorType}
          onValueChange={(value) => setSettings({ oscillatorType: value as OscillatorType })}
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
