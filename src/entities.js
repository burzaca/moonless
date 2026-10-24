// MOONLESS — entities: mobs, drops, beacons, NPCs, particles, collision.

import { T, BLOCKS_MOVE, makeRng } from './rng.js';
import { MOBS, NPCS } from './data.js';

let _id = 1;
export const nextId = () => _id++;

// ---------- collision ----------
export function tileSolid(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.W || ty >= world.H) return true;
  return BLOCKS_MOVE.has(world.tiles[ty * world.W + tx]);
}

export function circleHits(world, x, y, r) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileSolid(world, tx, ty)) return true;
  return false;
}

export function moveCircle(world, e, dx, dy, r = 0.32) {
  if (dx && !circleHits(world, e.x + dx, e.y, r)) e.x += dx;
  if (dy && !circleHits(world, e.x, e.y + dy, r)) e.y += dy;
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---------- line of sight (Bresenham through tiles) ----------
export function lineBlocked(world, x0, y0, x1, y1) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0, guard = 0;
  while (guard++ < 512) {
    if (x === x1 && y === y1) return false;
    if (!(x === x0 && y === y0) && BLOCKS_MOVE.has(world.tiles[y * world.W + x]) &&
        world.tiles[y * world.W + x] !== T.BRIDGE) {
      // walls block; water does not block sight
      if (world.tiles[y * world.W + x] !== T.WATER) return true;
    }
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return true;
}

// ---------- mobs ----------
export function makeMob(kind, x, y, tier) {
  const def = MOBS[kind];
  return {
    id: nextId(), kind, def, x, y,
    hp: def.hp, maxHp: def.hp,
    state: 'idle', t: Math.random() * 10, cd: 0, stagger: 0,
    wanderA: Math.random() * Math.PI * 2, wanderT: 0,
    aggro: false, hitFlash: 0, tier: tier ?? def.tier,
    anchorX: x, anchorY: y,
  };
}

export function spawnMobsFromWorld(world, rng) {
  const mobs = [];
  for (const s of world.mobSpawns) mobs.push(makeMob(s.kind, s.x + 0.5, s.y + 0.5, s.tier));
  return mobs;
}

export function updateMob(m, dt, game) {
  const { world, player, light } = game;
  const def = m.def;
  m.t += dt;
  if (m.cd > 0) m.cd -= dt;
  if (m.stagger > 0) m.stagger -= dt;
  if (m.hitFlash > 0) m.hitFlash -= dt;

  const d = dist(m, player);
  const sense = def.radius * (game.player.noticeMul || 1);
  const litHere = light.at(m.x, m.y);

  // bosses aggro by proximity only
  if (def.boss) {
    if (!m.aggro && d < 12 && !lineBlocked(world, m.x, m.y, player.x, player.y)) m.aggro = true;
  } else if (d < sense && !lineBlocked(world, m.x, m.y, player.x, player.y)) {
    m.aggro = true;
  } else if (d > sense * 2.2) {
    m.aggro = false;
  }

  // light behavior
  const slow = game.focusSlowMul ?? 1;
  if (def.behavior === 'drift') {
    // motes are drawn to light (moth-to-flame): approach player if player lit, burn anyway
    if (m.aggro && litHere < 0.85) approach(world, m, player, dt, def.speed * 0.8 * slow);
    else wander(world, m, dt, def.speed * 0.4 * slow);
  } else {
    // hunt, but stalkers fear strong light
    const fearsLight = m.kind === 'stalker' && litHere > 0.55;
    if (fearsLight && !def.boss) {
      const ax = m.x - player.x, ay = m.y - player.y, l = Math.hypot(ax, ay) || 1;
      moveCircle(world, m, (ax / l) * def.speed * dt, (ay / l) * def.speed * dt);
    } else if (m.aggro) {
      approach(world, m, player, dt, def.speed * slow);
    } else wander(world, m, dt, def.speed * 0.35 * slow);
  }

  // attack
  if (d < 0.75 && m.cd <= 0 && m.stagger <= 0) {
    m.cd = def.boss ? 2.0 : 1.0;
    game.damagePlayer(def.dmg, m);
    if (def.drainsOil) game.drainOil(def.drainsOil);
  }
}

function approach(world, m, target, dt, speed) {
  const dx = target.x - m.x, dy = target.y - m.y, l = Math.hypot(dx, dy) || 1;
  moveCircle(world, m, (dx / l) * speed * dt, (dy / l) * speed * dt);
}
function wander(world, m, dt, speed) {
  m.wanderT -= dt;
  if (m.wanderT <= 0) { m.wanderT = 1 + Math.random() * 2; m.wanderA = Math.random() * Math.PI * 2; }
  moveCircle(world, m, Math.cos(m.wanderA) * speed * dt, Math.sin(m.wanderA) * speed * dt);
}

// ---------- drops ----------
export function makeDrop(kind, x, y, relicId) {
  return { id: nextId(), kind, x, y, t: 0, relicId, bob: Math.random() * 6 };
}

// ---------- beacons ----------
export function makeBeacon(x, y) {
  return { id: nextId(), x, y, lit: true, radius: 5.2, income: 0.35, pulse: 0, age: 0 };
}

// ---------- NPCs ----------
export function makeNpc(defId, x, y) {
  const def = NPCS.find(n => n.id === defId);
  return { id: nextId(), defId, def, x, y, state: 'lost', t: 0, wanderA: Math.random() * 6.28, wanderT: 0, said: false };
}

export function updateNpc(n, dt, game) {
  n.t += dt;
  if (n.state === 'lost') {
    n.wanderT -= dt;
    if (n.wanderT <= 0) { n.wanderT = 2 + Math.random() * 3; n.wanderA = Math.random() * Math.PI * 2; }
    moveCircle(game.world, n, Math.cos(n.wanderA) * 0.5 * dt, Math.sin(n.wanderA) * 0.5 * dt, 0.3);
  } else if (n.state === 'awakened') {
    // walk toward hub gate
    const hx = game.world.hub.x + 0.5, hy = game.world.hub.y + game.world.hub.r + 2;
    const dx = hx - n.x, dy = hy - n.y, l = Math.hypot(dx, dy);
    if (l > 1.5) moveCircle(game.world, n, (dx / l) * 1.6 * dt, (dy / l) * 1.6 * dt, 0.3);
    else n.state = 'hub';
  }
}

// ---------- particles ----------
export function spark(game, x, y, color, n = 6, speed = 2.2, life = 0.5, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, color, size });
  }
}

export function updateParticles(game, dt) {
  const ps = game.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  if (ps.length > 400) ps.splice(0, ps.length - 400);
}
