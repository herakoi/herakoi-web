const APP_STORAGE_PREFIX = "herakoi.";

/**
 * Remove all app-owned keys from localStorage.
 * Returns the number of keys removed.
 */
export const clearHerakoiLocalStorage = (): number => {
  if (typeof window === "undefined") return 0;

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(APP_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  return keysToRemove.length;
};
