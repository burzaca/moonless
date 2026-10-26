// MOONLESS — persistence (localStorage; safe no-op in Node)

const KEY = 'moonl…e-v1';
const RUN_KEY = 'moonless-run-v1';   // plain ASCII on purpose; the meta key above predates this

export function loadMeta() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    // shape check: a slot written by anything else must never brick the game
    if (typeof d.upgrades !== 'object' || d.upgrades === null) return null;
    if (!Array.isArray(d.kingsSlain) || !Array.isArray(d.npcsSaved)) return null;
    return d;
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

export function saveRun(snap) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(RUN_KEY, JSON.stringify(snap));
    return true;
  } catch { return false; }
}

export function loadRun() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    if (d.v !== 1) return null;
    if (typeof d.worldSeed !== 'number') return null;
    return d;
  } catch { return null; }
}

export function wipeRun() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(RUN_KEY); } catch {}
}

export function hasRunSave() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(RUN_KEY) !== null;
  } catch { return false; }
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
    totalKills: 0,
    tidesSurvived: 0,
    achievements: [],      // ids
    discovered: [],        // landmark types ever seen (for tips/flavor)
    dread: 0,              // Kings unmade — drives how strong the dark is
    dawnSeen: false,       // the Dawn ending only fires once
  };
}
