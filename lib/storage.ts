/** Move browser data to the current product namespace without losing saved settings. */
export function migrateStorageKey(oldKey: string, newKey: string) {
  if (typeof window === "undefined") return;
  try {
    const previous = localStorage.getItem(oldKey);
    if (previous !== null) {
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, previous);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
