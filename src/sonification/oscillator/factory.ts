import { OscillatorSonifier } from "#src/sonification/oscillator/OscillatorSonifier";
import type { OscillatorControls } from "#src/sonification/oscillator/uiControls";

let sonifierSingleton: OscillatorSonifier | null = null;

export function getOscillatorSonifier(controls: OscillatorControls): OscillatorSonifier {
  if (!sonifierSingleton) {
    const state = controls.state;
    sonifierSingleton = new OscillatorSonifier(undefined, {
      minFreq: state.minFreq,
      maxFreq: state.maxFreq,
      minVol: state.minVol,
      maxVol: state.maxVol,
      oscillatorType: state.oscillatorType,
      fadeMs: 120,
    });
    controls.attach(sonifierSingleton);
  }
  return sonifierSingleton;
}
