import type { RestBehavior } from "#src/plugins/sonification/shared/motion";
import type { PianoPlayMode } from "./PianoSamplerSonifier";

export const pianoSamplerPluginId = "sonification/piano-sampler" as const;

export interface PianoSamplerConfig {
  noteMin: number;
  noteMax: number;
  velocityMin: number;
  velocityMax: number;
  noteDuration: string;
  /** When notes play: as the hand moves (default) or when the note changes. */
  playMode: PianoPlayMode;
  /** What to play when the hand rests in one spot (motion-driven modes). */
  restBehavior: RestBehavior;
  /** Motion mode: one more note per this distance travelled, in canvas heights. */
  motionStep: number;
  /** Motion mode: notes per second while the hand moves, however slowly. */
  minNotesPerSecond: number;
  /** Most notes per second per hand in motion mode. */
  maxNotesPerSecond: number;
}

export const defaultPianoSamplerConfig: PianoSamplerConfig = {
  noteMin: 36,
  noteMax: 83,
  velocityMin: 40,
  velocityMax: 127,
  noteDuration: "8n",
  playMode: "motion",
  restBehavior: "once",
  motionStep: 0.05,
  minNotesPerSecond: 2,
  maxNotesPerSecond: 12,
};
