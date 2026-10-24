// MOONLESS — deterministic world generation (see docs/INTERFACES.md §1).

import { makeRng, T, BLOCKS_MOVE, BLOCKS_SIGHT } from './rng.js';

const W = 220, H = 220;
const HUB_R = 14;
const B = { FIELDS: 0, PINES: 1, SALT: 2, RUINS: 3, HUB: 4 };
const LANDMARK_COUNTS = [['shrine', 6], ['grove', 4], ['spring', 4], ['obelisk', 3]];
const KINGS = [['king_stag', B.FIELDS], ['king_choir', B.SALT], ['king_hollow', B.RUINS]];
const MIN_LANDMARK_DIST = 25;
const MOB_COUNT = 150;
const BORDER = 2;

function floorFor(biome) {
  if (biome === B.SALT) return T.SAND;
  if (biome === B.RUINS) return T.RUIN_FLOOR;
  if (biome === B.HUB) return T.HUB_FLOOR;
  return T.GRASS;
}

export function generateWorld(seed) {
  seed = seed >>> 0;
  const rng = makeRng(seed);
  const nWarp = makeRng((seed + 7919) >>> 0);
  const nDetail = makeRng((seed + 15485863) >>> 0);
  const nPatch = makeRng((seed + 32452843) >>> 0);

  const tiles = new Uint8Array(W * H);
  const biome = new Uint8Array(W * H);
  const cx = W >> 1, cy = H >> 1;
  const hub = { x: cx, y: cy, r: HUB_R };
  const idx = (x, y) => y * W + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const distHub = (x, y) => Math.hypot(x - cx, y - cy);

  // --- Biomes: four angular sectors around the hub, warped by noise so borders wander.
  // Sector order (rotated by a seeded offset): fields, pines, salt, ruins.
  const rot = rng.range(0, Math.PI * 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = distHub(x, y);
      let b;
      if (d < HUB_R + 0.5) b = B.HUB;
      else if (d < 26 + nWarp.fbm(x, y, 20, 2) * 10) b = B.FIELDS;
      else {
        const warp = (nWarp.fbm(x, y, 55, 3) - 0.5) * 2.4;
        let a = Math.atan2(y - cy, x - cx) + rot + warp;
        a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        b = Math.floor(a / (Math.PI / 2)) % 4;
      }
      biome[idx(x, y)] = b;
    }
  }

  // --- Tiles per biome.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const b = biome[i];
      const n = nDetail.fbm(x, y, 9, 3);
      const p = nPatch.fbm(x, y, 16, 3);
      const r = rng.next();
      let t;
      switch (b) {
        case B.FIELDS:
          if (n > 0.62) t = T.TALLGRASS;
          else if (n < 0.32) t = T.DIRT;
          else t = T.GRASS;
          if (r < 0.015) t = T.PINE;
          else if (r < 0.025) t = T.ROCK;
          else if (r < 0.03) t = T.DEADTREE;
          break;
        case B.PINES: {
          const dense = p > 0.5 ? 0.42 : 0.18;
          if (r < dense) t = T.PINE;
          else if (r < dense + 0.05) t = T.DEADTREE;
          else t = n > 0.6 ? T.TALLGRASS : T.GRASS;
          break;
        }
        case B.SALT:
          if (p > 0.64) t = T.WATER;
          else t = T.SAND;
          if (t === T.SAND && r < 0.012) t = T.ROCK;
          else if (t === T.SAND && r < 0.02) t = T.DEADTREE;
          break;
        case B.RUINS:
          if (p > 0.52) t = T.RUIN_FLOOR;
          else t = n > 0.45 ? T.ASH : T.DIRT;
          if (r < 0.025) t = T.DEADTREE;
          else if (r < 0.035) t = T.ROCK;
          break;
        default:
          t = T.HUB_FLOOR;
      }
      tiles[i] = t;
    }
  }

  // --- Ruin wall fragments: broken rectangular outlines on a coarse grid.
  for (let gy = 0; gy < H; gy += 12) {
    for (let gx = 0; gx < W; gx += 12) {
      const ox = gx + rng.int(0, 4), oy = gy + rng.int(0, 4);
      const rw = rng.int(4, 8), rh = rng.int(4, 8);
      const roll = rng.next();
      if (!inBounds(ox + rw, oy + rh)) continue;
      if (biome[idx(ox, oy)] !== B.RUINS || biome[idx(ox + rw, oy + rh)] !== B.RUINS) continue;
      if (roll > 0.7) continue;
      for (let y = oy; y <= oy + rh; y++) {
        for (let x = ox; x <= ox + rw; x++) {
          const edge = x === ox || x === ox + rw || y === oy || y === oy + rh;
          const i = idx(x, y);
          if (edge) { if (rng.next() < 0.7) tiles[i] = T.RUIN_WALL; else tiles[i] = T.RUIN_FLOOR; }
          else tiles[i] = T.RUIN_FLOOR;
        }
      }
    }
  }

  // --- Map border: impassable rock.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) tiles[idx(x, y)] = T.ROCK;
    }
  }

  // --- Hub: floor disc, wall ring, south gate, cleared apron outside.
  for (let y = cy - HUB_R - 4; y <= cy + HUB_R + 4; y++) {
    for (let x = cx - HUB_R - 4; x <= cx + HUB_R + 4; x++) {
      const d = distHub(x, y);
      const i = idx(x, y);
      if (d < HUB_R - 0.5) tiles[i] = T.HUB_FLOOR;
      else if (d < HUB_R + 0.5) {
        const gate = y > cy && Math.abs(x - cx) <= 1;
        tiles[i] = gate ? T.HUB_FLOOR : T.HUB_WALL;
      } else if (d < HUB_R + 3) {
        tiles[i] = T.GRASS;
        biome[i] = B.FIELDS;
      }
    }
  }
  const spawn = { x: cx, y: cy + 4 };

  const clearArea = (x0, y0, rad, b) => {
    const fl = floorFor(b);
    for (let y = y0 - rad; y <= y0 + rad; y++) {
      for (let x = x0 - rad; x <= x0 + rad; x++) {
        if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) continue;
        if (Math.hypot(x - x0, y - y0) > rad + 0.3) continue;
        if (distHub(x, y) < HUB_R + 0.5) continue;
        tiles[idx(x, y)] = fl;
      }
    }
  };

  const landmarks = [];
  const farEnough = (x, y, minD) => landmarks.every(l => Math.hypot(l.x - x, l.y - y) >= minD);

  // --- King anchors: near the map edge, inside their biome, ground cleared around them.
  const KING_CLEAR = 8; // ~15-17 tiles across of open ground
  for (const [type, kb] of KINGS) {
    const cands = [];
    for (let y = 16; y < H - 16; y++) {
      for (let x = 16; x < W - 16; x++) {
        const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (edge > 26) continue;
        if (biome[idx(x, y)] !== kb) continue;
        // Prefer tiles whose surroundings are also in-biome.
        let ok = true;
        for (const [dx, dy] of [[-8, 0], [8, 0], [0, -8], [0, 8]]) {
          if (biome[idx(x + dx, y + dy)] !== kb) { ok = false; break; }
        }
        if (ok && farEnough(x, y, 60)) cands.push([x, y]);
      }
    }
    let pos;
    if (cands.length) pos = rng.pick(cands);
    else {
      // Fallback: pick an edge point and force the biome there.
      const ang = rot + KINGS.findIndex(k => k[0] === type) * 2.1;
      pos = [Math.round(cx + Math.cos(ang) * 90), Math.round(cy + Math.sin(ang) * 90)];
      for (let y = pos[1] - 12; y <= pos[1] + 12; y++)
        for (let x = pos[0] - 12; x <= pos[0] + 12; x++)
          if (inBounds(x, y) && Math.hypot(x - pos[0], y - pos[1]) <= 12) biome[idx(x, y)] = kb;
    }
    clearArea(pos[0], pos[1], KING_CLEAR, kb);
    landmarks.push({ type, x: pos[0], y: pos[1] });
  }

  // --- Regular landmarks: scattered, walkable, outside hub, >= 25 apart.
  const order = [];
  for (const [type, n] of LANDMARK_COUNTS) for (let k = 0; k < n; k++) order.push(type);
  for (const type of order) {
    let placed = false;
    for (let minD = MIN_LANDMARK_DIST; !placed && minD >= 10; minD -= 3) {
      for (let attempt = 0; attempt < 4000 && !placed; attempt++) {
        const x = rng.int(10, W - 11), y = rng.int(10, H - 11);
        if (distHub(x, y) < HUB_R + 10) continue;
        if (!farEnough(x, y, minD)) continue;
        if (BLOCKS_MOVE.has(tiles[idx(x, y)])) continue;
        clearArea(x, y, 2, biome[idx(x, y)]);
        landmarks.push({ type, x, y });
        placed = true;
      }
    }
  }

  // --- Corridors: straight 4-connected lines from the hub apron to every landmark.
  for (const l of landmarks) {
    const ang = Math.atan2(l.y - cy, l.x - cx);
    let x = Math.round(cx + Math.cos(ang) * (HUB_R + 1.5));
    let y = Math.round(cy + Math.sin(ang) * (HUB_R + 1.5));
    const carve = (px, py) => {
      if (px < BORDER || py < BORDER || px >= W - BORDER || py >= H - BORDER) return;
      if (distHub(px, py) < HUB_R + 0.5) return;
      const i = idx(px, py);
      const t = tiles[i];
      if (t === T.WATER) tiles[i] = T.BRIDGE;
      else if (BLOCKS_MOVE.has(t)) tiles[i] = floorFor(biome[i]);
    };
    carve(x, y);
    const dx = Math.abs(l.x - x), dy = Math.abs(l.y - y);
    const sx = l.x > x ? 1 : -1, sy = l.y > y ? 1 : -1;
    let err = dx - dy;
    while (x !== l.x || y !== l.y) {
      const e2 = 2 * err;
      if (e2 > -dy && x !== l.x) { err -= dy; x += sx; }
      else { err += dx; y += sy; }
      carve(x, y);
    }
  }

  // --- Reachability from spawn (used to keep mobs on connected ground).
  const reach = new Uint8Array(W * H);
  const stack = [idx(spawn.x, spawn.y)];
  reach[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!inBounds(nx, ny)) continue;
      const j = idx(nx, ny);
      if (reach[j] || BLOCKS_MOVE.has(tiles[j])) continue;
      reach[j] = 1;
      stack.push(j);
    }
  }

  // --- Mob spawns: tiered by distance from hub.
  const mobSpawns = [];
  for (let attempt = 0; attempt < 200000 && mobSpawns.length < MOB_COUNT; attempt++) {
    const x = rng.int(BORDER, W - BORDER - 1), y = rng.int(BORDER, H - BORDER - 1);
    const i = idx(x, y);
    if (!reach[i] || biome[i] === B.HUB) continue;
    const d = distHub(x, y);
    if (d < HUB_R + 8) continue;
    if (mobSpawns.some(m => Math.abs(m.x - x) + Math.abs(m.y - y) < 4)) continue;
    const tier = d < 40 ? 0 : d <= 80 ? 1 : 2;
    const r = rng.next();
    let kind;
    if (tier === 0) kind = 'mote';
    else if (tier === 1) kind = r < 0.6 ? 'mote' : 'stalker';
    else kind = r < 0.3 ? 'mote' : r < 0.7 ? 'stalker' : 'wraith';
    mobSpawns.push({ x, y, kind, tier });
  }

  return { W, H, tiles, biome, landmarks, hub, spawn, mobSpawns };
}

export function isWalkable(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.W || ty >= world.H) return false;
  return !BLOCKS_MOVE.has(world.tiles[ty * world.W + tx]);
}

export function blocksSight(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.W || ty >= world.H) return true;
  return BLOCKS_SIGHT.has(world.tiles[ty * world.W + tx]);
}
