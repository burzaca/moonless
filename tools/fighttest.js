// tools/fighttest.js — scripted King fights: mid-tier build vs each King.
// Uses the same BFS + keyboard-steering as the main bot, tuned for kiting.
import { Game } from '../src/engine.js';
import * as entities from '../src/entities.js';
import { defaultMeta } from '../src/save.js';

const KEYDIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function nextWaypoint(g, from, target) {
  const w = g.world;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  const tx = Math.floor(target.x), ty = Math.floor(target.y);
  if (sx === tx && sy === ty) return target;
  const prev = new Int32Array(w.W * w.H).fill(-2);
  const q = [sy * w.W + sx];
  prev[sy * w.W + sx] = -1;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % w.W, cy = (cur / w.W) | 0;
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) continue;
      const ni = ny * w.W + nx;
      if (prev[ni] !== -2) continue;
      if (!!entities.tileSolid(w, nx, ny)) continue;
      if (dx && dy && (!!entities.tileSolid(w, cx + dx, cy) || !!entities.tileSolid(w, cx, cy + dy))) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[ty * w.W + tx] === -2) return null;
  let cur = ty * w.W + tx;
  const path = [];
  while (cur !== -1) { path.push({ x: (cur % w.W) + 0.5, y: ((cur / w.W) | 0) + 0.5 }); cur = prev[cur]; }
  path.reverse();
  return path[1] || path[0] || target;
}

function steer(g, p, goal, lastU) {
  const px0 = p.x, py0 = p.y;
  let bestScore = -1e9, bk = [0, 0];
  const before = Math.hypot(goal.x - px0, goal.y - py0);
  for (const [kx, ky] of KEYDIRS) {
    const kl = Math.hypot(kx, ky);
    const ux = kx / kl, uy = ky / kl;
    let tx = px0, ty = py0;
    const step = 0.3;
    for (let i = 0; i < 2; i++) {
      if (!entities.circleHits(g.world, tx + ux * step, ty, 0.32)) tx += ux * step;
      if (!entities.circleHits(g.world, tx, ty + uy * step, 0.32)) ty += uy * step;
    }
    let score = (before - Math.hypot(goal.x - tx, goal.y - ty)) * 2;
    if (lastU[0] && ux * lastU[0] + uy * lastU[1] > 0.9) score += 0.1;
    if (score > bestScore) { bestScore = score; bk = [kx, ky]; }
  }
  if (bestScore < 0.02) {
    const [kx, ky] = KEYDIRS[Math.floor(Math.random() * 8)];
    if (!entities.circleHits(g.world, px0 + kx * 0.4, py0 + ky * 0.4, 0.32)) bk = [kx, ky];
  }
  return { input: { left: bk[0] < 0, right: bk[0] > 0, up: bk[1] < 0, down: bk[1] > 0 },
           lastU: [bk[0] / Math.SQRT2, bk[1] / Math.SQRT2] };
}

function fight(kingKind, upgrades, relics, seed = 42) {
  const meta = defaultMeta();
  meta.upgrades = upgrades;
  const g = new Game(meta, seed);
  g.setEntities(entities);
  g.mode = 'play';
  g.run.relics = relics.slice();
  const king = g.run.mobs.find(m => m.kind === kingKind);
  if (!king) return { king: kingKind, win: false, note: 'king not found' };
  const p = g.player;
  p.x = king.x + 8; p.y = king.y;
  const dt = 1 / 60;
  let t = 0, s = 0, wp = null, lastU = [0, 0];
  while (t < 240 && king.hp > 0 && p.hp > 0 && g.mode === 'play') {
    t += dt; s++;
    const dx = king.x - p.x, dy = king.y - p.y, d = Math.hypot(dx, dy);
    let goal = null;
    const want = g.lightRadius * 0.5;
    if (p.hp < p.maxHp * 0.35 && d < 8) {
      goal = { x: p.x - dx * 4, y: p.y - dy * 4 }; // disengage when hurt
    } else if (d > want + 2) {
      // approach the RING, not the King itself
      goal = { x: king.x - (dx / d) * want, y: king.y - (dy / d) * want };
    } else if (d < want - 2) {
      goal = { x: p.x - dx, y: p.y - dy };         // back off
    } else {
      // ORBIT: strafe tangentially so the King chases us around inside our light
      const sgn = ((dx > 0) === (dy > 0)) ? 1 : -1;
      goal = { x: p.x - dy * 0.8 * sgn, y: p.y + dx * 0.8 * sgn };
    }
    let input = { left: false, right: false, up: false, down: false };
    if (goal) {
      if (!wp || s % 30 === 0) wp = nextWaypoint(g, p, goal) || goal;
      if (wp && Math.hypot(wp.x - p.x, wp.y - p.y) < 0.7) wp = nextWaypoint(g, p, goal) || goal;
      const r = steer(g, p, wp || goal, lastU);
      input = r.input; lastU = r.lastU;
    }
    if (d < 4.5 && p.oil > 20) g.flash();
    if (p.oil < 25 && p.tallow >= 5) g.renderTallow(false);
    g.update(dt, input);
  }
  return {
    king: kingKind, win: king.hp <= 0, playerAlive: p.hp > 0,
    kingHpLeft: Math.max(0, Math.round(king.hp)), pHp: Math.round(p.hp),
    secs: Math.round(t), pOil: Math.round(p.oil),
  };
}

const mid = { lantern_radius: 2, lantern_burn: 3, oil_tank: 3, flash_power: 2, wick_mending: 2, focus_red: 1, tide_resist: 1 };
const relics = [
  { id: 'iron_martenitsa', name: 'Iron Martenitsa', desc: '', effect: { maxHp: 25 } },
  { id: 'zmei_scale', name: 'Zmei Scale', desc: '', effect: { burnDps: 0.25 } },
];
for (const k of ['king_stag', 'king_choir', 'king_hollow']) {
  for (const seed of [42, 7, 99]) {
    console.log(JSON.stringify(fight(k, mid, relics, seed)));
  }
}
