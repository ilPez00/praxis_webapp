/**
 * Per-domain tracker selection.
 * Each topic (domain) shows 1-2 trackers by default; the user picks which
 * ones to surface in the Quick Log flow. Preferences live in localStorage
 * so there's no network round-trip when opening the speeddial logger.
 */
const KEY = 'praxis_tracker_prefs_v1';
const DEFAULT_LIMIT = 2;

type PrefMap = Record<string, string[]>;

function read(): PrefMap {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(p: PrefMap): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // private mode / quota — silently ignore; fallback is the default selection
  }
}

/**
 * Return the user's chosen tracker ids for this domain, filtered to the
 * currently-available list. Falls back to the first DEFAULT_LIMIT ids.
 */
export function getSelectedTrackers(domain: string, available: string[]): string[] {
  if (available.length === 0) return [];
  const saved = read()[domain];
  if (saved && saved.length > 0) {
    const kept = saved.filter(id => available.includes(id));
    if (kept.length > 0) return kept;
  }
  return available.slice(0, DEFAULT_LIMIT);
}

export function setSelectedTrackers(domain: string, ids: string[]): void {
  const prefs = read();
  prefs[domain] = ids;
  write(prefs);
}
