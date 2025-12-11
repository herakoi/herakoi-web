/**
 * Oscillator sonifier UI controls live beside the sonifier so audio tuning stays cohesive.
 *
 * Why: Frequency/volume sliders and waveform selection directly change OscillatorSonifier
 * behavior, so we keep their wiring next to the module that consumes them.
 * What: We expose the elements, default state, label sync, and listener binding so entrypoints
 * can configure the sonifier without scattering audio math across files.
 * How: Create controls with the entrypoint's requireElement helper, pass defaults into the
 * OscillatorSonifier constructor, then bind listeners to push updates back into the sonifier.
 */

import { requireElement } from "#src/utils/dom";
import type { OscillatorSonifier } from "./OscillatorSonifier";

export type OscillatorControlState = {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
};

/**
 * OscillatorControls keeps audio slider elements and their state together.
 */
export class OscillatorControls {
  public readonly elements: {
    minFreqSlider: HTMLInputElement;
    maxFreqSlider: HTMLInputElement;
    minFreqValue: HTMLSpanElement;
    maxFreqValue: HTMLSpanElement;
    minVolSlider: HTMLInputElement;
    maxVolSlider: HTMLInputElement;
    minVolValue: HTMLSpanElement;
    maxVolValue: HTMLSpanElement;
    oscillatorTypeSelect: HTMLSelectElement;
  };

  public readonly state: OscillatorControlState;

  constructor() {
    const minFreqSlider = requireElement<HTMLInputElement>("modular-min-freq");
    const maxFreqSlider = requireElement<HTMLInputElement>("modular-max-freq");
    const minFreqValue = requireElement<HTMLSpanElement>("modular-min-freq-value");
    const maxFreqValue = requireElement<HTMLSpanElement>("modular-max-freq-value");
    const minVolSlider = requireElement<HTMLInputElement>("modular-min-vol");
    const maxVolSlider = requireElement<HTMLInputElement>("modular-max-vol");
    const minVolValue = requireElement<HTMLSpanElement>("modular-min-vol-value");
    const maxVolValue = requireElement<HTMLSpanElement>("modular-max-vol-value");
    const oscillatorTypeSelect = requireElement<HTMLSelectElement>("modular-oscillator-type");

    this.elements = {
      minFreqSlider,
      maxFreqSlider,
      minFreqValue,
      maxFreqValue,
      minVolSlider,
      maxVolSlider,
      minVolValue,
      maxVolValue,
      oscillatorTypeSelect,
    };

    this.state = {
      minFreq: Number(minFreqSlider.value) || 200,
      maxFreq: Number(maxFreqSlider.value) || 700,
      minVol: Number(minVolSlider.value) / 100 || 0,
      maxVol: Number(maxVolSlider.value) / 100 || 0.2,
      oscillatorType: (oscillatorTypeSelect.value || "sine") as OscillatorType,
    };
  }

  public attach(sonifier: OscillatorSonifier): void {
    this.syncLabels();
    this.bindListeners(sonifier);
  }

  private syncLabels(): void {
    const { minFreqValue, maxFreqValue, minVolValue, maxVolValue, minVolSlider, maxVolSlider } =
      this.elements;
    minFreqValue.textContent = String(this.state.minFreq);
    maxFreqValue.textContent = String(this.state.maxFreq);
    minVolValue.textContent = String(minVolSlider.value);
    maxVolValue.textContent = String(maxVolSlider.value);
  }

  private bindListeners(sonifier: OscillatorSonifier): void {
    const {
      minFreqSlider,
      maxFreqSlider,
      minFreqValue,
      maxFreqValue,
      minVolSlider,
      maxVolSlider,
      minVolValue,
      maxVolValue,
      oscillatorTypeSelect,
    } = this.elements;

    minFreqSlider.addEventListener("input", (event) => {
      this.state.minFreq = Number((event.target as HTMLInputElement).value);
      minFreqValue.textContent = String(this.state.minFreq);
      sonifier.configure({ minFreq: this.state.minFreq });
    });

    maxFreqSlider.addEventListener("input", (event) => {
      this.state.maxFreq = Number((event.target as HTMLInputElement).value);
      maxFreqValue.textContent = String(this.state.maxFreq);
      sonifier.configure({ maxFreq: this.state.maxFreq });
    });

    minVolSlider.addEventListener("input", (event) => {
      this.state.minVol = Number((event.target as HTMLInputElement).value) / 100;
      minVolValue.textContent = String(minVolSlider.value);
      sonifier.configure({ minVol: this.state.minVol });
    });

    maxVolSlider.addEventListener("input", (event) => {
      this.state.maxVol = Number((event.target as HTMLInputElement).value) / 100;
      maxVolValue.textContent = String(maxVolSlider.value);
      sonifier.configure({ maxVol: this.state.maxVol });
    });

    oscillatorTypeSelect.addEventListener("change", (event) => {
      const nextType = (event.target as HTMLSelectElement).value as OscillatorType;
      this.state.oscillatorType = nextType;
      sonifier.configure({ oscillatorType: nextType });
    });
  }
}
