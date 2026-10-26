// MOONLESS — headless bot: plays the game in Node to smoke-test and balance.
// Usage: node tools/simulate.js [seeds...]   (MOON_TRACE=1 for position trace)

import { pathToFileURL } from 'node:url';
import { Game } from '../src/engine.js';
import * as entities from '../src/entities.js';
import { defaultMeta } from '../src/save.js';
import { isWalkable } from '../src/worldgen.js';
import { UPGRADES as UPGRADES_LIST } from '../src/data.js';

// BFS pathfinder; no diagonal corner-cutting (player circle can't fit pinches)
function nextWaypoint(g, from, target) {
  const w = g.world;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  const tx = Math.floor(target.x), ty = Math.floor(target.y);
  if (sx === tx && sy === ty) return target;
  const prev = new Int32Array(w.W * w.H).fill(-2);
  const q = [sy * w.W + sx];
  prev[sy * w.W + sx] = -1;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found = -1;
  for (let head = 0; head < q.length && found === -1; head++) {
    const cur = q[head];
    const cx = cur % w.W, cy = (cur / w.W) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) continue;
      const ni = ny * w.W + nx;
      if (prev[ni] !== -2) continue;
      if (!isWalkable(w, nx, ny)) { prev[ni] = -3; continue; }
      if (dx !== 0 && dy !== 0 && (!isWalkable(w, cx + dx, cy) || !isWalkable(w, cx, cy + dy))) continue;
      prev[ni] = cur;
      if (nx === tx && ny === ty) { found = ni; break; }
      q.push(ni);
    }
  }
  if (found === -1) return null;
  let cur = found, steps = 0;
  while (prev[cur] >= 0 && steps < 20000) {
    const p = prev[cur];
    if (p % w.W === sx && ((p / w.W) | 0) === sy) break;
    cur = p; steps++;
  }
  return { x: (cur % w.W) + 0.5, y: ((cur / w.W) | 0) + 0.5 };
}

const KEYDIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

export function simulate(seed, maxSeconds = 600, meta = null) {
  const g = new Game(meta || defaultMeta(), seed);
  g.setEntities(entities);
  g.mode = 'play';
  const input = { left: false, right: false, up: false, down: false };
  const dt = 1 / 60;
  let target = null, targetKey = null, targetNpc = null, targetDrop = null, altarVisit = false, npcTry = 0, wp = null, deaths = 0, t = 0, s = 0, lastUx = 0, lastUy = 0, firstDeath = null;
  const stats = { survived: 0, deaths: 0 };

  while (t < maxSeconds && g.mode !== 'dawn') {
    t += dt; s++;
    if (g.mode === 'dead') {
      deaths++; if (firstDeath == null) firstDeath = t; g.respawn(); wp = null;
      // after dying, spend Kindling at the altar like a player would
      const cheapest = UPGRADES_LIST.filter(u => g.lvl(u.id) < u.maxLevel)
        .map(u => ({ u, cost: Math.round(u.cost * Math.pow(u.costGrowth, g.lvl(u.id))) }))
        .sort((a, b) => a.cost - b.cost)[0];
      if (cheapest && g.meta.kindling >= cheapest.cost) {
        target = { x: g.hubProps.altar.x + 1, y: g.hubProps.altar.y }; targetKey = null; targetNpc = null; targetDrop = null;
        altarVisit = true;
      }
      continue;
    }

    // pick target: nearest undiscovered landmark OR unawakened lost soul, else wander
    if (!target || Math.random() < 0.003) {
      let best = null, bd = 1e9, bestKind = null;
      // tallow/oil drops take priority only when the bot is poor and the drop is close
      if (g.player.tallow < 6) {
        for (const d of g.run.drops) {
          const dd = Math.hypot(d.x - g.player.x, d.y - g.player.y);
          if (dd < 12 && dd < bd) { bd = dd; best = d; bestKind = 'drop'; }
        }
      }
      if (bestKind !== 'drop') {
        for (const lm of g.world.landmarks) {
          const key = lm.type + lm.x + ',' + lm.y;
          if (g.run.discovered.has(key)) continue;
          const d = Math.hypot(lm.x - g.player.x, lm.y - g.player.y);
          if (d < bd) { bd = d; best = lm; bestKind = 'lm'; }
        }
      }
      for (const n of g.run.npcs) {
        if (n.state !== 'lost') continue;
        // only pursue a soul once its task is actually satisfiable (mirrors engine gates)
        const r = g.run;
        const ok = ({ merchant: g.player.tallow >= 10, cartographer: r.discovered.size >= 3,
          gravetender: r.beaconsPlaced >= 2, child: g.player.oil >= 15,
          bellwright: r.tidesSurvived >= 1, mothkeeper: r.kills >= 12 })[n.defId] || true;
        if (!ok) continue;
        const d = Math.hypot(n.x - g.player.x, n.y - g.player.y);
        if (d < 15 && d < bd) { bd = d; best = n; bestKind = 'npc'; }
      }
      if (best && bestKind === 'drop') { target = { x: best.x, y: best.y }; targetKey = null; targetNpc = null; targetDrop = best; }
      else if (best && bestKind === 'lm') { target = { x: best.x + 0.5, y: best.y + 0.5 }; targetKey = best.type + best.x + ',' + best.y; targetNpc = null; }
      else if (best && bestKind === 'npc') { target = { x: best.x, y: best.y }; targetKey = null; targetNpc = best; npcTry = 0; }
      else { target = { x: g.player.x + (Math.random() - 0.5) * 30, y: g.player.y + (Math.random() - 0.5) * 30 }; targetKey = null; targetNpc = null; }
      wp = null;
    }

    // drop target expires when collected
    if (targetDrop && !g.run.drops.includes(targetDrop)) { target = null; targetDrop = null; wp = null; }

    // arrived at the altar: open it, then the menu-buy logic below runs
    if (altarVisit && target) {
      const dl = Math.hypot(target.x - g.player.x, target.y - g.player.y);
      if (dl < 2) { g.interact(); altarVisit = false; target = null; wp = null; }
    }

    // arrived at a lost soul: interact repeatedly (task may gate it)
    if (targetNpc) {
      const dl = Math.hypot(targetNpc.x - g.player.x, targetNpc.y - g.player.y);
      if (targetNpc.state !== 'lost' || dl > 25) { target = null; targetNpc = null; wp = null; }
      else if (dl < 1.4) { g.interact(); npcTry++; if (npcTry > 240) { target = null; targetNpc = null; wp = null; } }
    }

    // arrived at a landmark: interact until discovered
    if (targetKey) {
      const dl = Math.hypot(target.x - g.player.x, target.y - g.player.y);
      if (g.run.discovered.has(targetKey)) { target = null; targetKey = null; wp = null; }
      else if (dl < 1.5) g.interact();
    } else if (target && Math.hypot(target.x - g.player.x, target.y - g.player.y) < 1.5) {
      target = null; wp = null;
    }
    if (!target) continue;

    // path
    if (s % 30 === 0 || !wp) wp = nextWaypoint(g, g.player, target) || target;
    if (wp && Math.hypot(wp.x - g.player.x, wp.y - g.player.y) < 0.7) wp = nextWaypoint(g, g.player, target) || target;
    const steer = wp || target;

    // choose the best of 8 keyboard directions by simulated progress
    const px0 = g.player.x, py0 = g.player.y;
    let bestScore = -1e9, bk = [0, 0];
    const before = Math.hypot(steer.x - px0, steer.y - py0);
    for (const [kx, ky] of KEYDIRS) {
      const kl = Math.hypot(kx, ky);
      const ux = kx / kl, uy = ky / kl;
      let tx = px0, ty = py0;
      const step = 0.3;
      for (let i = 0; i < 2; i++) {
        if (!entities.circleHits(g.world, tx + ux * step, ty, 0.32)) tx += ux * step;
        if (!entities.circleHits(g.world, tx, ty + uy * step, 0.32)) ty += uy * step;
      }
      let score = (before - Math.hypot(steer.x - tx, steer.y - ty)) * 2;
      if (lastUx && ux * lastUx + uy * lastUy > 0.9) score += 0.1;
      if (score > bestScore) { bestScore = score; bk = [kx, ky]; }
    }
    // if progress is zero (stuck), rotate to a random direction to unstick
    if (bestScore < 0.02) {
      const [kx, ky] = KEYDIRS[Math.floor(Math.random() * 8)];
      if (!entities.circleHits(g.world, px0 + kx * 0.4, py0 + ky * 0.4, 0.32)) bk = [kx, ky];
    }
    lastUx = bk[0] / Math.SQRT2; lastUy = bk[1] / Math.SQRT2;
    input.left = bk[0] < 0; input.right = bk[0] > 0; input.up = bk[1] < 0; input.down = bk[1] > 0;

    // survival behaviors
    const nearMob = g.run.mobs.some(m => Math.hypot(m.x - g.player.x, m.y - g.player.y) < 3);
    if (nearMob && g.player.oil > 20 && g.player.flashCd <= 0) g.flash();
    if (g.player.tallow >= 5 && g.run.beacons.length < g.beaconCap && g.player.oil >= 20) g.placeBeacon();
    if (g.player.tallow > 0) {
      const atCauldron = Math.hypot(g.hubProps.cauldron.x - g.player.x, g.hubProps.cauldron.y - g.player.y) < 2;
      const atBeacon = g.run.beacons.some(b => Math.hypot(b.x - g.player.x, b.y - g.player.y) < 1.5);
      if (atCauldron) g.renderTallow(false);
      else if (atBeacon && g.player.oil < g.oilMax * 0.6) g.renderTallow(true);
    }
    if (g.player.oil < g.oilMax * 0.25 && g.player.tallow === 0) {
      // retreat toward hub gate when nearly dry
      const gate = { x: g.world.hub.x + 0.5, y: g.world.hub.y + g.world.hub.r - 1 };
      if (Math.hypot(gate.x - g.player.x, gate.y - g.player.y) > 2) {
        wp = nextWaypoint(g, g.player, gate) || gate;
      }
    }
    // menus like a player
    if (g.ui.altar) {
      for (const u of UPGRADES_LIST) {
        const lvl = g.lvl(u.id);
        const cost = Math.round(u.cost * Math.pow(u.costGrowth, lvl));
        if (lvl < u.maxLevel && g.meta.kindling >= cost) {
          g.meta.kindling -= cost;
          g.meta.upgrades[u.id] = lvl + 1;
          break;
        }
      }
      g.ui.altar = false;
    }

    g.update(dt, input);
    if (process.env.MOON_TRACE && s % 600 === 0) {
      console.log(`t=${(s/60).toFixed(0)} pos=${g.player.x.toFixed(1)},${g.player.y.toFixed(1)} tgt=${target ? target.x + ',' + target.y : 'none'} hp=${g.player.hp.toFixed(0)} oil=${g.player.oil.toFixed(0)} mode=${g.mode} disc=${g.run.discovered.size}`);
    }

    if (!isFinite(g.player.x) || !isFinite(g.player.y) || !isFinite(g.player.hp)) {
      throw new Error(`NaN state at t=${t}: x=${g.player.x} y=${g.player.y} hp=${g.player.hp}`);
    }
  }
  return {
    survived: t, deaths, firstDeath,
    kills: g.run.kills, kindling: g.run.kindlingEarned,
    beacons: g.run.beaconsPlaced, landmarks: g.run.discovered.size,
    npcs: g.meta.npcsSaved.length, kings: g.meta.kingsSlain.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
  const list = seeds.length ? seeds : [1, 2, 3, 42, 99, 1234, 7777, 55555, 8080, 1337];
  let tot = { kills: 0, kindling: 0, landmarks: 0, deaths: 0, npcs: 0, kings: 0, beacons: 0 };
  for (const sd of list) {
    try {
      const r = simulate(sd, 420);
      console.log(`seed ${String(sd).padEnd(6)} survived=${r.survived.toFixed(0)}s kills=${r.kills} kindling=${r.kindling} landmarks=${r.landmarks} beacons=${r.beacons} npcs=${r.npcs} deaths=${r.deaths} kings=${r.kings}`);
      tot.kills += r.kills; tot.kindling += r.kindling; tot.landmarks += r.landmarks; tot.deaths += r.deaths; tot.npcs += r.npcs; tot.kings += r.kings; tot.beacons += r.beacons;
    } catch (e) {
      console.error(`seed ${sd} CRASH: ${e.message}`);
      process.exitCode = 1;
    }
  }
  const n = list.length;
  console.log(`\navg over ${n} seeds: kills=${(tot.kills/n).toFixed(1)} kindling=${(tot.kindling/n).toFixed(1)} landmarks=${(tot.landmarks/n).toFixed(1)} beacons=${(tot.beacons/n).toFixed(1)} npcs=${(tot.npcs/n).toFixed(1)} deaths=${(tot.deaths/n).toFixed(1)} kings=${(tot.kings/n).toFixed(1)}`);
}
