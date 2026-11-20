/**
 * Per-voice gain stage that ties a continuous tone to hand motion.
 *
 * Why: an oscillator sounds every frame a point is on the image, so a still hand (with
 * tracker jitter) keeps sounding. Motion makes it playable: sound while moving, or
 * repeated plucks whose rate follows the hand's speed.
 * What: createMotionGate() returns a gain node to route the voice through, and apply(),
 * called each frame with the point's motion.
 * How: "continuous" passes the voice through; "moving" fades it in while the point moves
 * (louder when faster) and out when it stops, like a bow; "plucked" restarts a short,
 * decaying envelope on each note the motion tracker makes due. Without motion data (no
 * point position), every mode plays continuously.
 */

import type { MotionState } from "./motion";

export type SoundMode = "continuous" | "moving" | "plucked";

export const soundModes: readonly SoundMode[] = ["moving", "plucked", "continuous"];

/** Speed (canvas heights per second) at which a bowed tone reaches full loudness. */
const FULL_LOUDNESS_SPEED = 0.5;
/** Loudness of a bowed tone at the slowest movement. */
const SLOW_LOUDNESS = 0.5;
const FADE_IN_S = 0.03;
const FADE_OUT_S = 0.12;
/** Decay time constant of a pluck. */
const PLUCK_DECAY_S = 0.15;

export type MotionGate = {
  node: GainNode;
  apply: (mode: SoundMode, motion: MotionState | null, time: number) => void;
  dispose: () => void;
};

export const createMotionGate = (ctx: BaseAudioContext, mode: SoundMode): MotionGate => {
  const node = ctx.createGain();
  // A voice that starts gated is silent until its first motion (or pluck).
  node.gain.value = mode === "continuous" ? 1 : 0;

  return {
    node,
    apply: (currentMode, motion, time) => {
      const gain = node.gain;
      if (currentMode === "continuous" || !motion) {
        gain.setTargetAtTime(1, time, FADE_IN_S);
        return;
      }
      if (currentMode === "moving") {
        const loudness = motion.moving
          ? SLOW_LOUDNESS + (1 - SLOW_LOUDNESS) * Math.min(1, motion.speed / FULL_LOUDNESS_SPEED)
          : 0;
        gain.setTargetAtTime(loudness, time, motion.moving ? FADE_IN_S : FADE_OUT_S);
        return;
      }
      if (motion.note) {
        gain.cancelScheduledValues(time);
        gain.setValueAtTime(1, time);
        gain.setTargetAtTime(0, time, PLUCK_DECAY_S);
      }
    },
    dispose: () => {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    },
  };
};
