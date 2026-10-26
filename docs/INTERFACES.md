# MOONLESS — module interface contracts (STRICT)

All modules are ES modules under `src/`, zero dependencies, must run in both browser and Node 22 (no DOM in delegated modules). All randomness must come from the provided seeded RNG — **fully deterministic** for a given seed.

Shared tile enum (defined in `src/rng.js` as `T` — import from there):

```js
export const T = {
  VOID:0, GRASS:1, DIRT:2, SAND:3, WATER:4, PINE:5, DEADTREE:6, ROCK:7,
  RUIN_FLOOR:8, RUIN_WALL:9, HUB_FLOOR:10, HUB_WALL:11, ASH:12, TALLGRASS:13, BRIDGE:14
};
export const BLOCKS_SIGHT = new Set([T.PINE, T.DEADTREE, T.RUIN_WALL, T.HUB_WALL, T.ROCK]);
export const BLOCKS_MOVE = new Set([T.VOID, T.WATER, T.PINE, T.DEADTREE, T.ROCK, T.RUIN_WALL, T.HUB_WALL]);
```

`src/rng.js` also exports:

```js
export function mulberry32(seed) -> () => number   // 0..1
export function makeRng(seed) -> { next(), int(min,max), range(a,b), pick(arr), chance(p), noise2D(x,y,scale) }
// noise2D: value noise, smooth, returns 0..1
```

---

## 1. `src/worldgen.js`

```js
import { makeRng, T } from './rng.js';

/**
 * Generate a deterministic world.
 * @param {number} seed
 * @returns {{
 *   W: number, H: number,                    // 220 x 220
 *   tiles: Uint8Array,                       // tiles[y*W+x], values from T
 *   biome: Uint8Array,                       // 0 fields,1 pines,2 salt,3 ruins,4 hub
 *   landmarks: Array<{type:string,x:number,y:number}>,
 *   hub: {x:number,y:number,r:number},       // center tile + radius of safe zone
 *   spawn: {x:number,y:number},              // player start (inside hub)
 *   mobSpawns: Array<{x:number,y:number,kind:string,tier:number}>
 * }}
 */
export function generateWorld(seed) { ... }

export function isWalkable(world, tx, ty) -> boolean   // out of bounds = false
export function blocksSight(world, tx, ty) -> boolean
```

Requirements:
- Hub at map center, radius ~14, floor HUB_FLOOR, ring HUB_WALL with a gap (gate) facing south.
- Biomes via value noise: fields (GRASS/TALLGRASS/DIRT), whisper pines (PINE/DEADTREE/GRASS), salt flats (SAND/WATER pools), sunken ruins (RUIN_FLOOR patches + RUIN_WALL fragments + ASH).
- Landmarks: 6 shrines, 4 groves, 4 springs, 3 obelisks, scattered — placed on walkable tiles, never inside hub, min distance 25 apart. `type` ∈ `shrine|grove|spring|obelisk`.
- mobSpawns: ~140 mobs. `kind` ∈ `mote|stalker|wraith`. tier = distance from hub: <40 → 0 (motes only), 40–80 → 1 (mote/stalker), >80 → 2 (all). Spawn on walkable, non-hub tiles.
- 3 king anchors: return them as landmarks with types `king_stag` (fields edge), `king_choir` (salt edge), `king_hollow` (ruins edge) — placed near map edges in their biome, ~15 tiles of cleared walkable ground around each.
- Bridges (BRIDGE) over water where needed to keep regions connected (simple: carve straight corridors between hub gate and each landmark, converting impassable tiles to BRIDGE/GRASS as needed).
- Deterministic: same seed → identical output.

## 2. `src/sprites.js`

```js
/**
 * @returns {{ w:number, h:number, palette:Object<string,string>, rows:string[] }}
 * rows: array of h strings of length w; each char is a palette key; '.' = transparent.
 */
export function getSprite(name) -> sprite | null
export function listSprites() -> string[]
```

Required names (16x16 unless noted; readable silhouettes, dark-fantasy pixel style):
- Player: `player_down1, player_down2, player_up1, player_up2, player_side1, player_side2` (hooded figure carrying a small lit lantern — lantern pixels use a bright warm color like `#ffd27a`)
- Mobs: `mote` (12x12 ember wisp), `stalker` (16x16 lean hound-shape), `wraith` (16x16 floating tattered shape), `king_stag` (24x24 antlered silhouette), `king_choir` (24x24 cluster of masked figures), `king_hollow` (24x24 crowned void)
- NPCs: `npc_merchant, npc_cartographer, npc_gravetender, npc_child, npc_bellwright, npc_mothkeeper` (16x16, distinct silhouettes/props: lantern-cart, map-tube, spade, tiny candle-child, hand-bell, moth-net)
- Props: `beacon` (16x16 unlit brazier), `beacon_lit`, `cauldron`, `shrine`, `obelisk`, `spring`, `grove_marker`, `tree_pine`, `tree_dead`, `rock`, `chest`, `banner`
- Pickups: `tallow` (10x10), `oilflask` (10x10), `kindling` (10x10 spark)
Palettes: desaturated dark fantasy; each sprite ≤ 8 colors. Every sprite must be non-empty and match declared w/h exactly.

## 3. `src/audio.js`

```js
export const SFX = {
  play(name) {},          // no-op if disabled or unknown name
  setEnabled(bool) {},
  isEnabled() -> boolean,
  startAmbient() {},      // slow dark drone, very quiet
  stopAmbient() {},
};
```
Pure WebAudio synthesis (oscillators, noise buffers, envelopes). No assets. Must not throw if `AudioContext` is unavailable (Node) — guard everything.
Required names: `step, pickup, burn, hit, hurt, flash, beacon_place, ui_click, ui_open, npc_awaken, kindling, boss_roar, tide_warn, death, upgrade, render_tallow`.

## 4. `src/data.js`

```js
export const MOBS = {
  mote:    { name:'Mote',    hp, speed, dmg, burnWeak:1.5, drops:{tallow:[1,2]}, radius:6,  behavior:'drift', tier:0, flavor:'...' },
  stalker: { name:'Stalker', hp, speed, dmg, burnWeak:1.0, drops:{tallow:[2,4]}, radius:9,  behavior:'hunt',  tier:1, flavor:'...' },
  wraith:  { name:'Wraith',  hp, speed, dmg, burnWeak:0.6, drops:{tallow:[3,6],oil:[1,2]}, radius:10, behavior:'hunt', drainsOil:2, tier:2, flavor:'...' },
  king_stag:   { name:'Stag of Cinders',   hp, speed, dmg, boss:true, kindling:25, drops:{tallow:[10,16]}, radius:12, behavior:'hunt', tier:2, flavor:'...' },
  king_choir:  { name:'The Drowned Choir', hp, speed, dmg, boss:true, kindling:35, drops:{tallow:[12,20]}, radius:14, behavior:'drift', drainsOil:3, tier:2, flavor:'...' },
  king_hollow: { name:'Hollowking',        hp, speed, dmg, boss:true, kindling:60, drops:{tallow:[20,30]}, radius:16, behavior:'hunt', tier:2, flavor:'...' },
};
// speed = tiles/sec (player is 4.2). dmg = hp per hit, hits ~1/sec when adjacent.

export const UPGRADES = [ // meta tree bought with Kindling at the Hollow
  // each: { id, name, desc, cost, maxLevel, effect:{key:perLevelValue} }
  // REQUIRED ids: lantern_radius, lantern_burn, oil_tank, flash_power, beacon_cap,
  //               focus_red, focus_gold, focus_blue, cauldron_yield, tide_resist,
  //               start_gear, wick_mending
];

export const NPCS = [ // 6 entries, ids: merchant, cartographer, gravetender, child, bellwright, mothkeeper
  // { id, name, title, sprite, findHint, taskHint, service, passive,
  //   dialogueAwaken:[3+ lines], dialogueHub:[4+ lines] }
];

export const RELICS = [ // 10 entries { id, name, desc, effect:{key,value} }
  // effect keys used by engine: lightRadius, burnDps, oilPerSec, moveSpeed, maxHp,
  // flashRadius, tallowBonus, tideResist, mobNotice, kindlingBonus
];

export const LANDMARK_TEXT = { shrine:[...], grove:[...], spring:[...], obelisk:[...],
  king_stag:'...', king_choir:'...', king_hollow:'...' };

export const TIPS = [ ... ]; // 10 loading/death screen tips in-world voice
```

Tone: melancholy but hopeful; short lines; no emoji. Bulgarian folklore flavor allowed (zmei, samodivi, khrosamir) but keep English.

Balance targets: early run survives ~3 min on starting lantern (oil 60, burn 1.2/s); a planted beacon yields 0.35 oil/sec base; tallow renders 1:3 into oil; Kindling per full first run ~40.

---

Validation: `tests/modules.test.js` (engine-owned) checks all of the above shapes. Modules that fail the contract get rewritten by the engine author.

---

# v2 contracts — the 2026-10-26 pack (Dread / new powers / save menu)

These are the contracts for the three features requested in muha7a's vault note of 26.10.2026.
Implement exactly these names — other modules are written against them in parallel.

## A. Dread — the dark escalates after every King falls

`meta.dread` (integer, default 0) is persisted in `defaultMeta()` and incremented **once per King
unmade**, including re-crowned Kings. Everything below derives from it; never store scaled stats.

`src/engine.js` — `Game` gains:

```js
dreadScale() -> { hp, dmg, speed, respawn, tideExtra }
// hp        = 1 + 0.22 * d
// dmg       = 1 + 0.15 * d
// speed     = min(1.45, 1 + 0.05 * d)
// respawn   = max(0.35, 1 - 0.07 * d)   // multiplier on respawn delay
// tideExtra = 3 * d                     // extra mobs per Tide wave
// d = this.meta.dread || 0  — must tolerate a missing field (older saves)
```

`src/entities.js`:

```js
makeMob(kind, x, y, tier, scale)   // scale optional, defaults to {hp:1,dmg:1,speed:1}
// hp/maxHp = def.hp * scale.hp (rounded); store m.dmgMul = scale.dmg, m.spdMul = scale.speed
// NEVER mutate MOBS entries — `def` is shared by every mob.
updateMob(m, dt, game)             // uses def.speed * (m.spdMul||1) and def.dmg * (m.dmgMul||1)
                                   // and multiplies speed by game.wardMul(m) (see C4)
spawnMobsFromWorld(world, rng, scale)  // 3rd arg optional
```

Every place the engine creates a mob (`buildRun` kings, `updateTide` wave, `respawnQueue`) passes
`this.dreadScale()`. Respawn delay is multiplied by `scale.respawn`.

On a King's death the engine calls `this.onKingSlain(m)` which:
1. `this.meta.dread++`
2. toasts `The dark remembers. Dread <roman>.`
3. raises a revenge wave: `6 + 2*d` non-boss mobs at 15–20 tiles around the player (walkable only).

**Endless Kings.** `endlessKings()` -> `this.meta.kingsSlain.length >= 3`.
- `buildRun()`: when endless, spawn all three King anchors again (they are no longer skipped),
  scaled by `dreadScale()`, and set `m.label = def.name + ' · ' + ordinal(crown)` where crown is a
  1-based roman numeral derived from `meta.dread` (export `roman(n)` from `src/engine.js`).
- `mode = 'dawn'` fires only the first time all three fall: guard with `meta.dawnSeen` (set it, and
  never re-enter dawn). Free play continues and Kings keep rising.
- When a King dies while endless, push `{ t: 90 + Math.random()*60, kind }` onto `run.kingQueue`;
  when it fires, re-crown that kind at its own landmark anchor with the current scale and toast
  `A new crown takes shape at the <biome>.`

## B. Five new POWER upgrades

`src/data.js` `UPGRADES` gains exactly these five entries (same shape as the existing ones, `desc`
prefixed `POWER:` like the current powers). Engine reads levels by **id**, e.g. `this.lvl('cinder_trail')`.

| id | name | cost | costGrowth | maxLevel | effect key |
|---|---|---|---|---|---|
| `ember_reaping` | Ember Reaping | 20 | 1.7 | 3 | `{ reaping: 1 }` |
| `cinder_trail` | Cinder Trail | 24 | 1.8 | 3 | `{ trail: 1 }` |
| `beacon_drum` | Beacon Drum | 26 | 1.8 | 3 | `{ drum: 1 }` |
| `ashen_ward` | Ashen Ward | 22 | 1.7 | 3 | `{ ward: 1 }` |
| `deathflare` | Deathflare | 28 | 1.9 | 3 | `{ flare: 1 }` |

Engine behaviour (level `L = this.lvl(id)`; do nothing when `L === 0`):

1. **Ember Reaping** — in `killMob`, a non-boss kill has a `0.06*L` chance to also drop a
   `kindling` drop (the pickup path already grants +1 Kindling). A King always drops `2 + L` kindling.
2. **Cinder Trail** — `this.trail` is an array of `{x,y,life}`. While moving with oil > 0, add a point
   every 0.35 s (cap 40 points, life 6 s). Each point adds light `radius 1.2, strength 0.35` and burns
   mobs within 0.7 for `5*L * (def.burnWeak||1)` dps. Expose `Game#trailTick(dt)`; the renderer may
   draw embers from `game.trail`.
3. **Beacon Drum** — expose `Game#beaconDrumTick(dt)`: every beacon pulses every `7 - 1.5*L` s,
   damaging mobs within `3.5 + L` for `5*L`.
4. **Ashen Ward** — expose `Game#wardMul(m)` returning `1 - 0.12*L` when the mob stands in light
   `> 0.4`, else 1. `updateMob` multiplies mob speed by it.
5. **Deathflare** — expose `Game#deathflare()`: fires only when `player.oil <= 0` and cooldown
   (`this._flareCd`, 30 s) has expired: damage `14*L` to mobs within `3 + L`, sparks, `this.shake`,
   and `this._flareT = 3` (the update loop adds light radius 4 while `_flareT > 0`). Call it from the
   oil-burn path the moment oil reaches 0.

All five must be inert when not purchased, and must not throw when `run.mobs` is empty.

## C. Save / Load / Reset menu (full run snapshot, one slot)

`src/save.js` gains (same localStorage safety pattern as the existing functions — no-op in Node):

```js
const RUN_KEY = '***';
saveRun(snap)      // JSON write, returns true/false
loadRun()          // -> snapshot object | null (validate: v===1 && typeof seed==='number')
wipeRun()          // remove the key
hasRunSave()       // -> boolean
```

`src/engine.js` — `Game` gains:

```js
snapshotRun() -> {
  v: 1, savedAt: Date.now(), seed: this.seed, worldSeed: this.worldSeed, time: this.time,
  player: {x,y,hp,oil,tallow,facing,flashCd,invuln},
  focus: this.focus,
  run: { beacons:[{x,y,radius,income,age,pulse}], relics:[ids], discovered:[keys],
         slainKings:[kinds], kills, beaconsPlaced, tidesSurvived, kindlingEarned,
         springUsed:[keys], darkSurvival },
  tide: { phase, t, warned }, dread: this.meta.dread,
}
restoreRun(snap) -> void
// set this.worldSeed = snap.worldSeed; this.rng = makeRng(worldSeed); regenerate world/light/fog;
// call buildRun() (deterministic from that rng), then overwrite player/focus/run/tide/time from the
// snapshot. Rebuild Sets from arrays; map relic ids back through RELICS. mode = 'play'.
```

`this.worldSeed` must be set in the constructor (`= seed`) and in `resetRun()` (`= the new seed`), so
a snapshot can regenerate the exact same map.

`src/main.js`:
- `game.ui.menu` (bool) + `game.ui.menuConfirm` (bool) + `game.ui.menuMsg` (string, feedback line).
- `Escape` closes any open overlay; if none is open it opens the menu. While the menu is open, movement
  and actions are ignored.
- Inside the menu: `1` = save the current expedition, `2` = load (restore) the saved expedition,
  `3` = reset all progress (first press sets `menuConfirm`, second press performs `wipeMeta()` +
  `wipeRun()` and starts a fresh game), `Escape` closes / cancels the confirm.
- Autosave every 15 s also writes `saveRun(game.snapshotRun())` while `mode === 'play'`.
- Title screen: if `hasRunSave()`, `Enter`/`E` resumes it via `restoreRun`, `N` starts a new world.
- Add a 4th touch button `{ key: 'MENU', label: 'menu', dx: -190, dy: -20 }` that toggles the menu.

`src/render.js`:
- `drawMenu()` — a `panel()` in the same style as `drawAltarMenu`, listing the three options, the
  contents of the existing run save if any (`saved <local time> · <mm:ss> walked · dread N · kings M ·
  kindling K`), the confirm prompt when `menuConfirm`, and `game.ui.menuMsg` after an action.
- HUD: when `meta.dread > 0`, show `dread <roman>` on the third HUD text line.
- Bosses: draw `m.label || m.def.name` above the boss HP bar so a re-crowned King is legible.
- Help overlay: document `ESC — save / load / reset`.
