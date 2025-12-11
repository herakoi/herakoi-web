/**
 * requireElement fetches a DOM element by id and throws with context when missing.
 *
 * Why: Multiple entrypoints need the same guarded lookup; centralizing it avoids
 * repeating null checks and keeps error messages consistent.
 */
export const requireElement = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Expected to find #${id} in the DOM`);
  return el as T;
};
