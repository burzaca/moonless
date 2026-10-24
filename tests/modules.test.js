// MOONLESS — contract tests for delegated modules. These MUST pass.
import test from 'node:test';
import assert from 'node:assert';

import { T } from '../src/rng.js';

// ---------- worldgen ----------
import { generateWorld, isWalkable, blocksSight } from '../src/worldgen.js';

test('worldgen: shape + determinism', () => {
  const w = generateWorld(42);
  assert.strictEqual(w.W, 220); assert.strictEqual(w.H, 220);
  assert.strictEqual(w.tiles.length, 220 * 220);
  assert.strictEqual(w.biome.length, 220 * 220);
  const w2 = generateWorld(42);
  assert.ok(w.tiles.every((v, i) => v === w2.tiles[i]), 'not deterministic');
  assert.ok(Array.isArray(w.landmarks) && w.landmarks.length >= 17, 'need >=17 landmarks (16 + 3 kings)');
  assert.ok(w.hub && typeof w.hub.x === 'number');
  assert.ok(isWalkable(w, w.spawn.x, w.spawn.y), 'spawn must be walkable');
  assert.ok(w.mobSpawns.length >= 140, 'need >=140 mobSpawns');
  for (const lm of w.landmarks) {
    assert.ok(['shrine','grove','spring','obelisk','king_stag','king_choir','king_hollow'].includes(lm.type), 'bad landmark ' + lm.type);
  }
  const types = w.landmarks.map(l => l.type);
  for (const k of ['king_stag','king_choir','king_hollow']) assert.ok(types.includes(k), 'missing ' + k);
  for (const s of w.mobSpawns) assert.ok(['mote','stalker','wraith'].includes(s.kind), 'bad mob kind');
  // hub walkable around spawn
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
    assert.ok(isWalkable(w, w.spawn.x + dx, w.spawn.y + dy), 'hub interior must be walkable');
});

test('worldgen: kings near edges, landmarks outside hub', () => {
  const w = generateWorld(7);
  for (const lm of w.landmarks) {
    const dh = Math.hypot(lm.x - w.hub.x, lm.y - w.hub.y);
    if (!lm.type.startsWith('king_')) assert.ok(dh > w.hub.r + 2, 'landmark inside hub');
    else assert.ok(dh > 60, 'king too close to hub');
  }
});

// ---------- sprites ----------
import { getSprite, listSprites } from '../src/sprites.js';

const REQUIRED_SPRITES = [
  'player_down1','player_down2','player_up1','player_up2','player_side1','player_side2',
  'mote','stalker','wraith','king_stag','king_choir','king_hollow',
  'npc_merchant','npc_cartographer','npc_gravetender','npc_child','npc_bellwright','npc_mothkeeper',
  'beacon','beacon_lit','cauldron','shrine','obelisk','spring','grove_marker',
  'tree_pine','tree_dead','rock','chest','banner','tallow','oilflask','kindling',
];

test('sprites: all required exist and are well-formed', () => {
  const names = new Set(listSprites());
  for (const n of REQUIRED_SPRITES) assert.ok(names.has(n), 'missing sprite: ' + n);
  for (const n of names) {
    const sp = getSprite(n);
    assert.ok(sp && sp.w > 0 && sp.h > 0, n + ': bad dims');
    assert.strictEqual(sp.rows.length, sp.h, n + ': rows != h');
    for (const r of sp.rows) assert.strictEqual(r.length, sp.w, n + ': row width mismatch');
    let painted = 0;
    for (const r of sp.rows) for (const ch of r) {
      if (ch === '.') continue;
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(sp.palette[ch] || ''), n + ': bad palette char ' + ch);
      painted++;
    }
    assert.ok(painted > sp.w, n + ': too sparse');
  }
});

// ---------- audio ----------
import { SFX } from '../src/audio.js';

test('audio: importable in node, no-op play, toggle', () => {
  assert.strictEqual(typeof SFX.play, 'function');
  SFX.play('pickup'); // must not throw without AudioContext
  SFX.setEnabled(false);
  assert.strictEqual(SFX.isEnabled(), false);
  SFX.setEnabled(true);
  SFX.startAmbient(); SFX.stopAmbient();
});

// ---------- data ----------
import { MOBS, UPGRADES, NPCS, RELICS, LANDMARK_TEXT, TIPS } from '../src/data.js';

test('data: mobs complete', () => {
  for (const k of ['mote','stalker','wraith','king_stag','king_choir','king_hollow']) {
    const m = MOBS[k];
    assert.ok(m, 'missing mob ' + k);
    for (const f of ['name','hp','speed','dmg','drops','radius','behavior','tier','flavor'])
      assert.ok(m[f] !== undefined, `${k}.${f} missing`);
    assert.ok(Array.isArray(m.drops.tallow) && m.drops.tallow.length === 2);
    assert.ok(m.speed > 0 && m.speed < 6 && m.hp > 0 && m.dmg > 0);
  }
});

test('data: upgrades complete', () => {
  const ids = UPGRADES.map(u => u.id);
  for (const id of ['lantern_radius','lantern_burn','oil_tank','flash_power','beacon_cap',
    'focus_red','focus_gold','focus_blue','cauldron_yield','tide_resist','start_gear','wick_mending'])
    assert.ok(ids.includes(id), 'missing upgrade ' + id);
  for (const u of UPGRADES) {
    assert.ok(u.name && u.desc && u.cost > 0 && u.maxLevel >= 1, 'bad upgrade ' + u.id);
  }
});

test('data: npcs complete', () => {
  const ids = NPCS.map(n => n.id);
  for (const id of ['merchant','cartographer','gravetender','child','bellwright','mothkeeper'])
    assert.ok(ids.includes(id), 'missing npc ' + id);
  for (const n of NPCS) {
    assert.ok(n.name && n.title && n.taskHint && n.service, 'npc fields ' + n.id);
    assert.ok(n.dialogueAwaken.length >= 3, n.id + ' needs 3+ awaken lines');
    assert.ok(n.dialogueHub.length >= 4, n.id + ' needs 4+ hub lines');
    for (const l of [...n.dialogueAwaken, ...n.dialogueHub])
      assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(l), 'no emoji allowed');
  }
});

test('data: relics + text + tips', () => {
  assert.ok(RELICS.length >= 10);
  const allowed = new Set(['lightRadius','burnDps','oilPerSec','moveSpeed','maxHp','flashRadius','tallowBonus','tideResist','mobNotice','kindlingBonus']);
  for (const r of RELICS) {
    assert.ok(r.id && r.name && r.desc && r.effect, 'relic fields');
    for (const k of Object.keys(r.effect)) assert.ok(allowed.has(k), 'bad effect key ' + k);
  }
  for (const k of ['shrine','grove','spring','obelisk']) assert.ok((LANDMARK_TEXT[k] || []).length >= 1);
  assert.ok(TIPS.length >= 10);
});
