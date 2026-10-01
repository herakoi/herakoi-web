export const PIANO_SCALES = ["chromatic", "major", "pentatonic"] as const;

export type PianoScale = (typeof PIANO_SCALES)[number];

export const PIANO_SCALE_LABELS: Record<PianoScale, string> = {
  chromatic: "Chromatic (all notes)",
  major: "Major (C)",
  pentatonic: "Major pentatonic (C)",
};

/** Pitch classes (semitones above C) allowed by each scale. */
const SCALE_PITCH_CLASSES: Record<PianoScale, readonly number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
};

/**
 * Lists the MIDI notes in [noteMin, noteMax] that belong to the scale, ascending.
 * Falls back to every note in range when the scale has none there, so a narrow range never goes silent.
 */
export function buildScaleNotes(noteMin: number, noteMax: number, scale: PianoScale): number[] {
  const low = Math.min(noteMin, noteMax);
  const high = Math.max(noteMin, noteMax);
  const pitchClasses = SCALE_PITCH_CLASSES[scale] ?? SCALE_PITCH_CLASSES.chromatic;

  const all: number[] = [];
  const inScale: number[] = [];
  for (let midi = low; midi <= high; midi++) {
    all.push(midi);
    if (pitchClasses.includes(((midi % 12) + 12) % 12)) inScale.push(midi);
  }

  return inScale.length > 0 ? inScale : all;
}

/**
 * Maps a position in [0, 1] to one of the scale notes, splitting the range evenly
 * so each note gets the same share of hue.
 */
export function pickScaleNote(scaleNotes: readonly number[], position: number): number {
  const clamped = Math.max(0, Math.min(1, position));
  const index = Math.round(clamped * (scaleNotes.length - 1));
  return scaleNotes[index];
}
