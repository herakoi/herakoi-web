import { pickScaleNote } from "./scale";

export interface NoteGateOptions {
  /** Extra distance past the boundary between two notes, as a fraction of a note's band (0–0.45). */
  hysteresis: number;
  /** Minimum time between two notes of the same point, in ms. */
  minIntervalMs: number;
}

export interface LastNote {
  note: number;
  triggeredAt: number;
}

/**
 * Decides whether a point should trigger a new note.
 * Returns the MIDI note to play, or null when the point should stay on its last note.
 *
 * Hysteresis keeps noisy colors near a note boundary from flipping between two notes:
 * the position must cross the boundary by `hysteresis` of a band before the note changes.
 */
export function nextNote(
  scaleNotes: readonly number[],
  position: number,
  last: LastNote | undefined,
  nowMs: number,
  options: NoteGateOptions,
): number | null {
  const exactIndex = Math.max(0, Math.min(1, position)) * (scaleNotes.length - 1);
  const candidate = pickScaleNote(scaleNotes, position);

  if (!last) return candidate;
  if (candidate === last.note) return null;

  // The last note may not be in the scale anymore after a settings change: switch right away.
  const lastIndex = scaleNotes.indexOf(last.note);
  if (lastIndex !== -1 && Math.abs(exactIndex - lastIndex) <= 0.5 + options.hysteresis) {
    return null;
  }

  if (nowMs - last.triggeredAt < options.minIntervalMs) return null;

  return candidate;
}
