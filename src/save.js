// MOONLESS — persistence (localStorage; safe no-op in Node)

const KEY = 'moonl…e-v1';

export function loadMeta() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : null;
  } catch { return null; }
}

export function saveMeta(meta) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

export function wipeMeta() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch {}
}

export function defaultMeta() {
  return {
    kindling: 0,
    upgrades: {},          // id -> level
    npcsSaved: [],         // ids of awakened souls living at the Hollow
    kingsSlain: [],        // ids
    runs: 0,
    bestTierReached: 0,
    totalKindling: 0,
    discovered: [],        // landmark types ever seen (for tips/flavor)
  };
}
