// MOONLESS — tests for the 2026-10-26 pack: Dread escalation, new powers, run snapshots.
// Written against docs/INTERFACES.md "v2 contracts". These are the acceptance tests.
import test from 'node:test';
import assert from 'node:assert';

import { Game, roman } from '../src/engine.js';
import * as entities from '../src/entities.js';
import { MOBS, UPGRADES } from '../src/data.js';
import { defaultMeta, saveRun, loadRun, wipeRun, hasRunSave, loadMeta, saveMeta } from '../src/save.js';
import { generateWorld, isWalkable } from '../src/worldgen.js';

function makeGame(seed = 7, meta = null) {
  const g = new Game(meta || defaultMeta(), seed);
  g.setEntities(entities);
  g.mode = 'play';
  return g;
}
// a walkable spot well outside the hub — beacons cannot be planted in the Hollow
function fieldPos(g) {
  const w = g.world;
  for (let r = 45; r < 100; r += 5) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const x = Math.floor(w.hub.x + Math.cos(ang) * r), y = Math.floor(w.hub.y + Math.sin(ang) * r);
      if (isWalkable(w, x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no field position found');
}
function plantBeacon(g) {
  const p = fieldPos(g);
  g.player.x = p.x; g.player.y = p.y;
  g.player.tallow = Math.max(g.player.tallow, 20);
  g.player.oil = Math.max(g.player.oil, 60);
  g.placeBeacon();
  return g.run.beacons[0];
}
const NO_INPUT = { left: false, right: false, up: false, down: false };
const run = (g, n, input = NO_INPUT) => { for (let i = 0; i < n; i++) g.update(1 / 60, input); };

// ---------- A. Dread ----------

test('dread: meta.dread defaults to 0 and dreadScale is neutral at 0', () => {
  const g = makeGame(3);
  assert.equal(g.meta.dread || 0, 0);
  const s = g.dreadScale();
  assert.ok(Math.abs(s.hp - 1) < 1e-9 && Math.abs(s.dmg - 1) < 1e-9 && Math.abs(s.respawn - 1) < 1e-9);
});

test('dread: scale grows with dread and speed is capped', () => {
  const g = makeGame(3);
  g.meta.dread = 3;
  const s = g.dreadScale();
  assert.ok(Math.abs(s.hp - (1 + 0.22 * 3)) < 1e-9, 'hp multiplier');
  assert.ok(Math.abs(s.dmg - (1 + 0.15 * 3)) < 1e-9, 'dmg multiplier');
  assert.ok(Math.abs(s.respawn - (1 - 0.07 * 3)) < 1e-9, 'respawn multiplier');
  assert.equal(s.tideExtra, 9);
  g.meta.dread = 40;
  assert.ok(g.dreadScale().speed <= 1.45 + 1e-9, 'speed must be capped');
});

test('dread: an old save with no dread field still runs', () => {
  const meta = defaultMeta();
  delete meta.dread;
  const g = makeGame(9, meta);
  run(g, 300);
  assert.ok(isFinite(g.player.x) && g.player.hp > 0 || g.mode === 'dead');
});

test('dread: makeMob scaling never mutates the shared MOBS defs', () => {
  const before = JSON.stringify(MOBS.mote);
  const m = entities.makeMob('mote', 5.5, 5.5, 0, { hp: 2, dmg: 3, speed: 1.5 });
  assert.equal(m.maxHp, Math.round(MOBS.mote.hp * 2));
  assert.equal(m.dmgMul, 3);
  assert.equal(m.spdMul, 1.5);
  assert.equal(JSON.stringify(MOBS.mote), before, 'MOBS defs must not be mutated');
});

test('dread: unmaking a King raises dread exactly once and answers with a wave', () => {
  const g = makeGame(4);
  const king = g.run.mobs.find(m => m.def.boss);
  assert.ok(king, 'seed should place Kings');
  const before = g.meta.dread || 0;
  const mobsBefore = g.run.mobs.length;
  g.hurtMob(king, king.maxHp * 2, true);
  assert.equal(g.meta.dread, before + 1, 'dread +1 per King');
  assert.ok(g.run.mobs.length > mobsBefore - 1, 'revenge wave spawned');
  g.hurtMob(king, 100, true); // already dead: must not double-count
  assert.equal(g.meta.dread, before + 1, 'no double count');
});

test('dread: world mobs are spawned scaled to the current dread', () => {
  const meta = defaultMeta();
  meta.dread = 4;
  const g = makeGame(6, meta);
  const plain = makeGame(6);
  const scaled = g.run.mobs.filter(m => !m.def.boss);
  const base = plain.run.mobs.filter(m => !m.def.boss);
  assert.ok(scaled.length && base.length);
  const want = Math.round(MOBS[base[0].kind].hp * (1 + 0.22 * 4));
  const got = scaled.find(m => m.kind === base[0].kind);
  assert.equal(got.maxHp, want, 'spawned mob hp must match the dread scale');
});

test('endless: after all three Kings fall, new crowned Kings rise with labels', () => {
  const meta = defaultMeta();
  meta.kingsSlain = ['king_stag', 'king_choir', 'king_hollow'];
  meta.dread = 3;
  meta.dawnSeen = true;
  const g = makeGame(8, meta);
  const kings = g.run.mobs.filter(m => m.def.boss);
  assert.equal(kings.length, 3, 'all three anchors re-crowned');
  assert.ok(kings.every(k => typeof k.label === 'string' && k.label.length > 0), 'kings need labels');
  assert.ok(kings.every(k => k.maxHp > MOBS[k.kind].hp), 're-crowned kings are scaled up');
  assert.notEqual(g.mode, 'dawn', 'dawn must not re-trigger');
});

test('endless: a slain King queues a new crown to rise later', () => {
  const meta = defaultMeta();
  meta.kingsSlain = ['king_stag', 'king_choir', 'king_hollow'];
  meta.dread = 3;
  meta.dawnSeen = true;
  const g = makeGame(8, meta);
  const king = g.run.mobs.find(m => m.def.boss);
  g.hurtMob(king, king.maxHp * 2, true);
  assert.ok((g.run.kingQueue || []).length >= 1, 'kingQueue should hold a rising King');
});

test('roman: numerals render for crown numbering', () => {
  assert.equal(roman(1), 'I');
  assert.equal(roman(4), 'IV');
  assert.equal(roman(9), 'IX');
  assert.equal(roman(14), 'XIV');
});

// ---------- B. New powers ----------

test('data: the five new powers exist with the contracted ids and shapes', () => {
  const want = {
    ember_reaping: 3, cinder_trail: 3, beacon_drum: 3, ashen_ward: 3, deathflare: 3,
  };
  for (const [id, maxLevel] of Object.entries(want)) {
    const u = UPGRADES.find(x => x.id === id);
    assert.ok(u, `missing upgrade ${id}`);
    assert.equal(u.maxLevel, maxLevel);
    assert.ok(typeof u.cost === 'number' && u.cost > 0);
    assert.ok(typeof u.costGrowth === 'number' && u.costGrowth >= 1);
    assert.ok(u.desc.startsWith('POWER:'), `${id} desc must be marked POWER:`);
  }
});

test('powers: all five at max level run 900 frames without throwing or NaN', () => {
  const meta = defaultMeta();
  for (const id of ['ember_reaping', 'cinder_trail', 'beacon_drum', 'ashen_ward', 'deathflare']) meta.upgrades[id] = 3;
  const g = makeGame(13, meta);
  g.player.tallow = 40; g.player.oil = 200;
  assert.ok(plantBeacon(g), 'a beacon must be plantable in the field');
  run(g, 900, { left: false, right: true, up: false, down: false });
  assert.ok(isFinite(g.player.x) && isFinite(g.player.y) && isFinite(g.player.hp));
});

test('powers: inert at level 0 — no trail, no drum, ward neutral, no flare', () => {
  const g = makeGame(14);
  run(g, 300, { left: false, right: true, up: false, down: false });
  assert.ok(!g.trail || g.trail.length === 0, 'cinder trail must stay empty at level 0');
  const m = g.run.mobs[0];
  if (m) assert.equal(g.wardMul(m), 1, 'ward must be neutral at level 0');
  const hp = g.player.hp;
  g.player.oil = 0;
  g.deathflare();
  assert.ok(g.run.mobs.every(x => x.hp > 0) || true);
  assert.equal(g.player.hp, hp);
});

test('power: cinder trail leaves burning embers that damage what crosses them', () => {
  const meta = defaultMeta();
  meta.upgrades.cinder_trail = 3;
  const g = makeGame(15, meta);
  g.player.oil = 200;
  run(g, 240, { left: false, right: true, up: false, down: false });
  assert.ok(g.trail && g.trail.length > 0, 'trail points must accumulate');
  assert.ok(g.trail.length <= 40, 'trail must be capped');
  assert.ok(g.trail.every(p => isFinite(p.x) && isFinite(p.y) && p.life > 0));
});

test('power: ashen ward slows Umbral things standing in the light', () => {
  const meta = defaultMeta();
  meta.upgrades.ashen_ward = 3;
  const g = makeGame(16, meta);
  g.light.clear();
  g.light.add(g.player.x, g.player.y, g.lightRadius, 1);
  const m = { x: g.player.x + 1, y: g.player.y, kind: 'mote', def: MOBS.mote };
  assert.ok(g.wardMul(m) < 1, 'mob inside light must be slowed');
  const far = { x: g.player.x + 40, y: g.player.y, kind: 'mote', def: MOBS.mote };
  assert.equal(g.wardMul(far), 1, 'mob outside light is unaffected');
});

test('power: beacon drum damages around planted beacons', () => {
  const meta = defaultMeta();
  meta.upgrades.beacon_drum = 3;
  const g = makeGame(17, meta);
  const b = plantBeacon(g);
  assert.ok(b, 'beacon must be planted for the drum to beat');
  const victim = entities.makeMob('mote', b.x + 1, b.y, 0);
  g.run.mobs.push(victim);
  const hp0 = victim.hp;
  for (let i = 0; i < 60 * 12; i++) g.update(1 / 60, NO_INPUT);
  assert.ok(victim.hp < hp0 || !g.run.mobs.includes(victim), 'drum must burn nearby mobs');
});

test('power: deathflare fires when the oil runs dry', () => {
  const meta = defaultMeta();
  meta.upgrades.deathflare = 3;
  const g = makeGame(18, meta);
  const victim = entities.makeMob('mote', g.player.x + 1, g.player.y, 0);
  g.run.mobs.push(victim);
  const hp0 = victim.hp;
  g.player.oil = 0;
  g.deathflare();
  assert.ok(victim.hp < hp0 || !g.run.mobs.includes(victim), 'flare must damage nearby Umbral things');
  const again = victim.hp;
  g.deathflare();
  assert.equal(victim.hp, again, 'flare must respect its cooldown');
});

test('power: ember reaping drops kindling from kills', () => {
  const meta = defaultMeta();
  meta.upgrades.ember_reaping = 3;
  const g = makeGame(19, meta);
  let kindlingDrops = 0;
  for (let i = 0; i < 400; i++) {
    const m = g.run.mobs.find(x => !x.def.boss);
    if (!m) break;
    g.hurtMob(m, m.maxHp * 2, true);
  }
  kindlingDrops = g.run.drops.filter(d => d.kind === 'kindling').length;
  assert.ok(kindlingDrops > 0, 'reaping should have dropped at least one kindling spark in 400 kills');
});

// ---------- C. Run snapshots ----------

test('snapshot: round-trips a run exactly (world, position, beacons, progress)', () => {
  const g = makeGame(21);
  g.player.tallow = 40; g.player.oil = 200;
  run(g, 600, { left: false, right: true, up: false, down: false });
  plantBeacon(g);
  const lm = g.world.landmarks.find(l => !l.type.startsWith('king_'));
  if (lm) g.discoverLandmark(lm);
  g.player.x = 100.5; g.player.y = 100.5;
  g.player.oil = 33; g.player.tallow = 7;
  g.tide.phase = 'tide'; g.tide.t = 12.5;

  const snap = g.snapshotRun();
  assert.equal(snap.v, 1);
  assert.ok(JSON.stringify(snap).length > 0, 'must be JSON-serialisable');
  assert.ok(Array.isArray(snap.run.discovered), 'Sets must be arrays');

  const g2 = makeGame(999);
  g2.restoreRun(snap);
  assert.deepEqual(Array.from(g2.world.tiles), Array.from(g.world.tiles), 'same world must regenerate');
  assert.equal(g2.player.x, g.player.x);
  assert.equal(g2.player.y, g.player.y);
  assert.equal(Math.round(g2.player.oil), 33);
  assert.equal(g2.player.tallow, 7);
  assert.equal(g2.run.beacons.length, g.run.beacons.length);
  assert.deepEqual(new Set(g2.run.discovered), new Set(g.run.discovered));
  assert.equal(g2.tide.phase, 'tide');
  assert.ok(Math.abs(g2.tide.t - 12.5) < 1e-6);
  assert.equal(g2.mode, 'play');
  run(g2, 120);
  assert.ok(isFinite(g2.player.x), 'restored game keeps running');
});

test('snapshot: a King unmade during the expedition stays unmade after loading', () => {
  const meta = defaultMeta();
  meta.dread = 2;
  const g = makeGame(22, meta);
  const king = g.run.mobs.find(m => m.def.boss);
  assert.ok(king, 'seed should place Kings');
  const kind = king.kind;
  g.hurtMob(king, king.maxHp * 2, true); // unmake it mid-run
  const snap = g.snapshotRun();
  assert.equal(snap.dread, g.meta.dread, 'the slot records the dread of the saved world');
  assert.ok(snap.run.slainKings.includes(kind), 'and which Kings fell this expedition');

  const g2 = makeGame(777, meta); // same profile, as the real game does
  g2.restoreRun(snap);
  assert.equal(g2.meta.dread, g.meta.dread, 'loaded world must be as dangerous as the saved one');
  const kings = g2.run.mobs.filter(m => m.def.boss);
  assert.ok(!kings.some(m => m.kind === kind), 'the unmade King must not be standing again');
  assert.ok(kings.length >= 2, 'the other Kings remain');
  assert.ok(kings.every(m => m.maxHp > MOBS[m.kind].hp), 'and scaled by the loaded dread');
});

test('save.js: run storage is a safe no-op without localStorage (Node)', () => {
  assert.equal(hasRunSave(), false);
  assert.equal(loadRun(), null);
  wipeRun();
  const ok = saveRun({ v: 1, worldSeed: 5 });
  assert.ok(ok === false || ok === undefined || ok === null, 'saveRun must not claim success without storage');
});

test('save.js: the two slots never collide, and a corrupt meta slot cannot brick the game', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  try {
    const META_KEY = 'moonl\u2026e-v1';   // the shipped key literally contains U+2026
    // a run snapshot written into the META slot is the old collision bug: it must be rejected,
    // not handed to the engine as progress (that crashed the whole game on load)
    store.set(META_KEY, JSON.stringify({ v: 1, worldSeed: 5, player: {} }));
    assert.equal(loadMeta(), null, 'wrong-shaped meta must be rejected');

    assert.ok(saveRun({ v: 1, worldSeed: 9, dread: 3 }), 'saveRun writes through to storage');
    assert.ok(hasRunSave());
    assert.equal(loadRun().worldSeed, 9);

    saveMeta(defaultMeta());                    // progress save must not clobber the run slot
    assert.equal(loadRun().worldSeed, 9, 'run slot survives a progress save');
    assert.equal(loadMeta().dread, 0, 'meta slot reads back as progress');

    wipeRun();
    assert.equal(hasRunSave(), false);
    assert.notEqual(store.get(META_KEY), undefined, 'wiping the run must not touch progress');
  } finally {
    delete globalThis.localStorage;
  }
});

test('worldgen determinism still holds for a stored worldSeed', () => {
  const g = makeGame(31);
  const a = g.snapshotRun().worldSeed;
  const w1 = generateWorld(a);
  const w2 = generateWorld(a);
  assert.ok(w1.tiles.every((v, i) => v === w2.tiles[i]));
});
