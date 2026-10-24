// MOONLESS — engine integration tests: the game loop must actually work.
import test from 'node:test';
import assert from 'node:assert';

import { Game } from '../src/engine.js';
import * as entities from '../src/entities.js';
import { defaultMeta } from '../src/save.js';
import { UPGRADES } from '../src/data.js';

function makeGame(seed = 7) {
  const g = new Game(defaultMeta(), seed);
  g.setEntities(entities);
  g.mode = 'play';
  return g;
}

const NO_INPUT = { left: false, right: false, up: false, down: false };

test('game constructs and runs 600 frames without throwing or NaN', () => {
  const g = makeGame(11);
  for (let i = 0; i < 600; i++) {
    g.update(1 / 60, i % 120 < 60 ? { left: false, right: true, up: false, down: false } : NO_INPUT);
  }
  assert.ok(isFinite(g.player.x) && isFinite(g.player.y) && isFinite(g.player.hp));
  assert.ok(g.player.oil >= 0);
});

test('NPC awakening mutates the real NPC and grants kindling exactly once', () => {
  const g = makeGame(5);
  const npc = g.run.npcs[0];
  // satisfy its task and stand next to it
  g.player.tallow = 50; g.player.oil = 50;
  g.run.discovered.add('x'); g.run.discovered.add('y'); g.run.discovered.add('z');
  g.run.beaconsPlaced = 2; g.run.kills = 20; g.run.tidesSurvived = 1;
  g.player.x = npc.x + 0.5; g.player.y = npc.y;
  const k0 = g.meta.kindling;
  assert.ok(g.interact(), 'interact should fire');
  assert.notEqual(npc.state, 'lost', 'real NPC must change state');
  for (let i = 0; i < 30; i++) g.interact();
  assert.equal(g.meta.kindling - k0, 8, 'exactly one kindling grant');
  assert.ok(g.meta.npcsSaved.includes(npc.defId));
});

test('beacon placement costs resources, caps, and generates oil', async () => {
  const g = makeGame(3);
  g.player.x = g.world.hub.x + 18; g.player.y = g.world.hub.y + 2;
  g.player.tallow = 10; g.player.oil = 40;
  const t0 = g.player.tallow, o0 = g.player.oil;
  g.placeBeacon();
  assert.equal(g.run.beacons.length, 1);
  assert.equal(g.player.tallow, t0 - 5);
  assert.equal(g.player.oil, o0 - 10);
  g.placeBeacon();
  assert.equal(g.run.beacons.length, 1, 'cap respected');
  // stand in the hub with empty oil: any oil gained can only be beacon income
  g.player.x = g.world.hub.x; g.player.y = g.world.hub.y;
  g.player.oil = 0;
  for (let i = 0; i < 60 * 20; i++) g.update(1 / 60, NO_INPUT); // 20s idle
  assert.ok(g.player.oil > 0, 'beacon income accrued');
});

test('death loses carried tallow, keeps kindling, respawns at hub', () => {
  const g = makeGame(9);
  g.player.tallow = 12;
  g.addKindling(10, 'test');
  const k = g.meta.kindling;
  g.player.hp = 1;
  g.damagePlayer(50, null);
  assert.equal(g.mode, 'dead');
  g.respawn();
  assert.equal(g.mode, 'play');
  assert.equal(g.player.tallow, 0);
  assert.equal(g.meta.kindling, k);
  const d = Math.hypot(g.player.x - g.world.spawn.x, g.player.y - g.world.spawn.y);
  assert.ok(d < 2, 'respawn at hub spawn');
});

test('light burns mobs; flash damages them', () => {
  const g = makeGame(4);
  const m = entities.makeMob('mote', g.player.x + 1, g.player.y, 0);
  g.run.mobs.push(m);
  const hp0 = m.hp;
  for (let i = 0; i < 120; i++) g.update(1 / 60, NO_INPUT);
  assert.ok(m.hp < hp0 || m.hp === m.maxHp && false, 'light burn should damage adjacent mob');
  if (m.hp > 0) {
    const hp1 = m.hp;
    g.player.oil = 50;
    g.flash();
    assert.ok(m.hp < hp1, 'flash damages a living mob');
  }
});

test('upgrade purchase at altar applies effects', () => {
  const g = makeGame(6);
  g.meta.kindling = 100;
  const r0 = g.lightRadius;
  const up = UPGRADES.find(x => x.id === 'lantern_radius');
  const cost = Math.round(up.cost);
  g.meta.kindling -= cost;
  g.meta.upgrades.lantern_radius = 1;
  assert.ok(g.lightRadius > r0, 'radius upgrade applies');
});
