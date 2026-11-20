/**
 * Per-voice effects driven by a sample's extra layer.
 *
 * Why: layered images (FITS) carry a layer beyond the colours; it should be heard
 * through its own sound property, separate from pitch (hue) and loudness (value).
 * What: createVoiceEffect() builds the node chain for one voice and returns `apply`,
 * which sets the effect from a 0–1 value (or null for "no data": neutral sound).
 * How: each voice's gain is routed through the chain to the destination. Changes
 * are smoothed with setTargetAtTime so a moving finger does not click.
 */

export type VoiceEffectKind = "none" | "chorus" | "vibrato" | "lowpass" | "pan";

export const voiceEffectKinds: readonly VoiceEffectKind[] = [
  "none",
  "chorus",
  "vibrato",
  "lowpass",
  "pan",
];

export type VoiceEffect = {
  /** Set the effect from a 0–1 value; null means no data and leaves the sound neutral. */
  apply: (value: number | null, amount: number, time: number) => void;
  /** Stop LFOs and disconnect the chain. */
  dispose: () => void;
};

/** Smoothing time constant for effect parameters, in seconds. */
const SMOOTHING = 0.03;

const VIBRATO_RATE_HZ = 5.5;
/** Vibrato depth at full amount and value: one semitone either way. */
const VIBRATO_MAX_CENTS = 100;

const LOWPASS_OPEN_HZ = 16000;
/** Cutoff for value 0 at full amount. */
const LOWPASS_CLOSED_HZ = 120;

const CHORUS_RATE_HZ = 1.2;
const CHORUS_DELAYS_S = [0.02, 0.03] as const;
const CHORUS_DEPTH_S = 0.004;

const disconnectAll = (nodes: AudioNode[]) => {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // Already disconnected.
    }
  }
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const createVoiceEffect = (
  ctx: BaseAudioContext,
  kind: VoiceEffectKind,
  osc: OscillatorNode,
  voice: AudioNode,
  destination: AudioNode,
): VoiceEffect => {
  switch (kind) {
    case "pan": {
      const panner = ctx.createStereoPanner();
      voice.connect(panner);
      panner.connect(destination);
      return {
        apply: (value, amount, time) => {
          const pan = value === null ? 0 : (2 * clamp01(value) - 1) * clamp01(amount);
          panner.pan.setTargetAtTime(pan, time, SMOOTHING);
        },
        dispose: () => disconnectAll([panner]),
      };
    }

    case "lowpass": {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 1;
      filter.frequency.value = LOWPASS_OPEN_HZ;
      voice.connect(filter);
      filter.connect(destination);
      return {
        apply: (value, amount, time) => {
          // Low values close the filter (darker); the amount sets how far it can close.
          const closed = LOWPASS_OPEN_HZ * (LOWPASS_CLOSED_HZ / LOWPASS_OPEN_HZ) ** clamp01(amount);
          const t = value === null ? 1 : clamp01(value);
          const cutoff = closed * (LOWPASS_OPEN_HZ / closed) ** t;
          filter.frequency.setTargetAtTime(cutoff, time, SMOOTHING);
        },
        dispose: () => disconnectAll([filter]),
      };
    }

    case "vibrato": {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = VIBRATO_RATE_HZ;
      depth.gain.value = 0;
      lfo.connect(depth);
      depth.connect(osc.detune);
      lfo.start();
      voice.connect(destination);
      return {
        apply: (value, amount, time) => {
          const cents = value === null ? 0 : clamp01(value) * clamp01(amount) * VIBRATO_MAX_CENTS;
          depth.gain.setTargetAtTime(cents, time, SMOOTHING);
        },
        dispose: () => {
          try {
            lfo.stop();
          } catch {
            // Already stopped.
          }
          disconnectAll([lfo, depth]);
        },
      };
    }

    case "chorus": {
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = CHORUS_RATE_HZ;
      wet.gain.value = 0;
      voice.connect(dry);
      dry.connect(destination);
      wet.connect(destination);
      // Two delayed copies swing in opposite directions around their base delay.
      const taps = CHORUS_DELAYS_S.flatMap((base, index) => {
        const delay = ctx.createDelay(0.1);
        const modulation = ctx.createGain();
        delay.delayTime.value = base;
        modulation.gain.value = index === 0 ? CHORUS_DEPTH_S : -CHORUS_DEPTH_S;
        lfo.connect(modulation);
        modulation.connect(delay.delayTime);
        voice.connect(delay);
        delay.connect(wet);
        return [delay, modulation];
      });
      lfo.start();
      return {
        apply: (value, amount, time) => {
          const mix = value === null ? 0 : clamp01(value) * clamp01(amount);
          // Lower the dry signal as the copies come in, to keep loudness about even.
          dry.gain.setTargetAtTime(1 - 0.4 * mix, time, SMOOTHING);
          wet.gain.setTargetAtTime(0.7 * mix, time, SMOOTHING);
        },
        dispose: () => {
          try {
            lfo.stop();
          } catch {
            // Already stopped.
          }
          disconnectAll([dry, wet, lfo, ...taps]);
        },
      };
    }

    default: {
      voice.connect(destination);
      return { apply: () => {}, dispose: () => {} };
    }
  }
};

/** Rate of the "no data" pulse: a slow on/off, well apart from the vibrato rate. */
export const NO_DATA_PULSE_HZ = 2;

/** Proximity pulse rates: far from data (at or beyond the reach) and right next to it. */
const PROXIMITY_FAR_HZ = 1;
const PROXIMITY_NEAR_HZ = 8;

/**
 * Pulse rate for a distance to data: `closeness` 0 is at the reach or beyond, 1 is next
 * to the data. Exponential, so each step closer sounds like the same speed-up.
 */
export const proximityPulseRate = (closeness: number) =>
  PROXIMITY_FAR_HZ * (PROXIMITY_NEAR_HZ / PROXIMITY_FAR_HZ) ** clamp01(closeness);
/**
 * Sharpness of each pulse: the LFO's sine, mapped to 0–1, is raised to this power, so
 * the tone is audible for about a fifth of each cycle (a short blip) and quiet otherwise.
 */
const NO_DATA_PULSE_SHARPNESS = 8;

const pulseCurve = (() => {
  const size = 1024;
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = ((x + 1) / 2) ** NO_DATA_PULSE_SHARPNESS;
  }
  return curve;
})();

export type NoDataPulse = {
  /** The node voices connect through. */
  node: AudioNode;
  /** Pulse the voice with blips at `rateHz`, or pass it through unchanged (null). */
  set: (rateHz: number | null, time: number) => void;
  dispose: () => void;
};

/**
 * A gain stage that marks "no data here" by pulsing the voice's loudness, so a missing
 * value never sounds like a real one (e.g. a centred pan like a mid value).
 */
export const createNoDataPulse = (ctx: BaseAudioContext): NoDataPulse => {
  const node = ctx.createGain();
  const lfo = ctx.createOscillator();
  const shape = ctx.createWaveShaper();
  const depth = ctx.createGain();
  node.gain.value = 1;
  depth.gain.value = 0;
  lfo.frequency.value = NO_DATA_PULSE_HZ;
  shape.curve = pulseCurve;
  lfo.connect(shape);
  shape.connect(depth);
  depth.connect(node.gain);
  lfo.start();
  return {
    node,
    set: (rateHz, time) => {
      const active = rateHz !== null;
      if (active) lfo.frequency.setTargetAtTime(rateHz, time, SMOOTHING);
      // Gain is base + depth × pulse (0–1): short blips when active, steady 1 otherwise.
      node.gain.setTargetAtTime(active ? 0 : 1, time, SMOOTHING);
      depth.gain.setTargetAtTime(active ? 1 : 0, time, SMOOTHING);
    },
    dispose: () => {
      try {
        lfo.stop();
      } catch {
        // Already stopped.
      }
      disconnectAll([node, lfo, shape, depth]);
    },
  };
};
