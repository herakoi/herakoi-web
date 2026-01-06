import { usePipelineStore } from "../../state/pipelineStore";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";

export const AudioPanel = () => {
  const oscillator = usePipelineStore((state) => state.oscillator);
  const setOscillator = usePipelineStore((state) => state.setOscillator);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Frequency range ({oscillator.minFreq}Hz – {oscillator.maxFreq}Hz)
        </Label>
        <Slider
          min={100}
          max={2000}
          step={10}
          value={[oscillator.minFreq, oscillator.maxFreq]}
          aria-label="Frequency range"
          thumbLabels={["Minimum frequency", "Maximum frequency"]}
          onValueChange={([min, max]) => setOscillator({ minFreq: min, maxFreq: max })}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Volume range ({Math.round(oscillator.minVol * 100)}% –{" "}
          {Math.round(oscillator.maxVol * 100)}%)
        </Label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[oscillator.minVol * 100, oscillator.maxVol * 100]}
          aria-label="Volume range"
          thumbLabels={["Minimum volume", "Maximum volume"]}
          onValueChange={([min, max]) => setOscillator({ minVol: min / 100, maxVol: max / 100 })}
        />
      </div>
      <div className="space-y-2">
        <Label>Waveform</Label>
        <Select
          value={oscillator.oscillatorType}
          onValueChange={(value) => setOscillator({ oscillatorType: value as OscillatorType })}
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
