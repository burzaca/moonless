// MOONLESS — core engine: game state, light field, economy, tide, interactions.

import { makeRng, T } from './rng.js';
import { generateWorld, isWalkable, blocksSight } from './worldgen.js';
import { MOBS, UPGRADES, NPCS, RELICS, LANDMARK_TEXT, TIPS } from './data.js';
import {
  makeMob, spawnMobsFromWorld, makeDrop, makeBeacon, makeNpc,
  updateMob, updateNpc, updateParticles, spark, dist, lineBlocked, nextId,
} from './entities.js';

const BASE = {
  hp: 20, speed: 4.2, oil: 60, burn: 1.2,
  lightRadius: 6, burnDps: 6,
  flashDmg: 8, flashRadius: 4, flashCost: 8, flashCd: 6,
  beaconCap: 1, cauldronYield: 3,
  calmTime: 210, tideTime: 60,
};

export class LightField {
  constructor(world) {
    this.world = world;
    this.field = new Float32Array(world.W * world.H);
    this.dirty = [];
  }
  clear() { for (const i of this.dirty) this.field[i] = 0; this.dirty.length = 0; }
  add(x, y, radius, strength = 1) {
    const { world, field, dirty } = this;
    const x0 = Math.max(0, Math.floor(x - radius)), x1 = Math.min(world.W - 1, Math.ceil(x + radius));
    const y0 = Math.max(0, Math.floor(y - radius)), y1 = Math.min(world.H - 1, Math.ceil(y + radius));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d > radius) continue;
        let v = strength * (1 - d / radius);
        if (v <= 0) continue;
        if (blocksSight(world, tx, ty) && !this._los(x, y, tx + 0.5, ty + 0.5)) v *= 0.15;
        const idx = ty * world.W + tx;
        if (field[idx] <= 0) dirty.push(idx);
        if (v > field[idx]) field[idx] = v;
      }
    }
  }
  _los(x0, y0, x1, y1) { return !lineBlocked(this.world, x0, y0, x1, y1); }
  at(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.world.W || ty >= this.world.H) return 0;
    return this.field[ty * this.world.W + tx];
  }
}

export class Game {
  constructor(meta, seed) {
    this.meta = meta;
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.world = generateWorld(this.seed);
    this.light = new LightField(this.world);
    this.fog = new Uint8Array(this.world.W * this.world.H);
    this.mode = 'title'; // title | play | dead | dawn
    this.ui = { altar: false, merchant: false, dialogue: null, help: false };
    this.toasts = [];
    this.particles = [];
    this.time = 0;
    this.shake = 0;
    this.buildRun();
  }

  // ---------- derived stats ----------
  lvl(id) { return this.meta.upgrades[id] || 0; }
  upSum(key) {
    let v = 0;
    for (const u of UPGRADES) {
      const l = this.lvl(u.id);
      if (l > 0 && u.effect && u.effect[key]) v += u.effect[key] * l;
    }
    return v;
  }
  eff(key) {
    let v = BASE[key] ?? 0;
    v += this.upSum(key);
    for (const r of (this.run?.relics || [])) {
      if (r.effect[key]) v += r.effect[key];
    }
    return v;
  }
  relicVal(key) { let v = 0; for (const r of (this.run?.relics || [])) if (r.effect[key]) v += r.effect[key]; return v; }

  get lightRadius() {
    let r = this.eff('lightRadius');
    if (this.focus === 'red') r *= 0.85;
    if (this.focus === 'gold') r *= 1.1;
    if (this.focus === 'blue') r *= 0.9;
    return r;
  }
  get burnDps() {
    let d = this.eff('burnDps');
    if (this.focus === 'red') d *= 1.6;
    if (this.focus === 'blue') d *= 0.8;
    return d;
  }
  get oilMax() { return BASE.oil + this.upSum('maxOil'); }
  get maxHp() { return BASE.hp + this.relicVal('maxHp'); }
  get speed() { return BASE.speed + this.relicVal('moveSpeed'); }
  get beaconCap() { return BASE.beaconCap + this.lvl('beacon_cap'); }
  hasFocus(f) { return this.lvl('focus_' + f) > 0; }
  get focusSlowMul() { return this.focus === 'blue' ? 0.7 : 1; }

  // ---------- run lifecycle ----------
  buildRun() {
    const w = this.world;
    this.player = {
      x: w.spawn.x + 0.5, y: w.spawn.y + 0.5, hp: this.maxHp, maxHp: this.maxHp,
      oil: this.eff('oil'), tallow: 0, facing: 'down', animT: 0, moving: false,
      flashCd: 0, invuln: 0, noticeMul: 1,
    };
    this.focus = 'white';
    this.run = {
      beacons: [], mobs: spawnMobsFromWorld(w, this.rng), npcs: [], drops: [],
      relics: [], discovered: new Set(), slainKings: new Set(),
      kills: 0, beaconsPlaced: 0, tidesSurvived: 0, deaths: 0,
      kindlingEarned: 0, startTime: 0, springUsed: new Set(),
      respawnQueue: [], // {t, kind, x, y, tier}
    };
    // place NPCs in the wilds
    const npcIds = NPCS.map(n => n.id);
    let placed = 0, guard = 0;
    while (placed < npcIds.length && guard++ < 4000) {
      const x = this.rng.int(10, w.W - 10), y = this.rng.int(10, w.H - 10);
      const dh = Math.hypot(x - w.hub.x, y - w.hub.y);
      if (dh < 30 || dh > 95 || !isWalkable(w, x, y)) continue;
      this.run.npcs.push(makeNpc(npcIds[placed], x + 0.5, y + 0.5));
      placed++;
    }
    // kings live at their landmark anchors
    for (const lm of w.landmarks) {
      if (!lm.type.startsWith('king_')) continue;
      if (this.meta.kingsSlain.includes(lm.type)) continue;
      const kind = lm.type;
      const m = makeMob(kind, lm.x + 0.5, lm.y + 0.5, 2);
      this.run.mobs.push(m);
    }
    // tide
    this.tide = { phase: 'calm', t: this.calmTime(), warned: false };
    // hub cauldron + altar positions
    this.hubProps = {
      cauldron: { x: w.hub.x + 0.5, y: w.hub.y - 4.5 },
      altar: { x: w.hub.x - 4.5, y: w.hub.y + 0.5 },
      banner: { x: w.hub.x + 4.5, y: w.hub.y + 0.5 },
    };
    if (this.meta.npcsSaved.includes('cartographer')) this.revealRandomFog(30);
  }

  resetRun() {
    this.rng = makeRng(this.seed + this.meta.runs * 7919 + 13);
    this.world = generateWorld(this.seed + this.meta.runs * 7919 + 13);
    this.light = new LightField(this.world);
    this.fog = new Uint8Array(this.world.W * this.world.H);
    this.particles = [];
    this.buildRun();
  }

  die() {
    this.mode = 'dead';
    this.run.deaths++;
    this.meta.runs++;
    this.meta.bestTierReached = Math.max(this.meta.bestTierReached, this.playerTier());
    this.deathTip = this.rng.pick(TIPS);
    this.player.hp = 0;
  }

  respawn() {
    const w = this.world;
    this.player.x = w.spawn.x + 0.5; this.player.y = w.spawn.y + 0.5;
    this.player.hp = this.maxHp;
    this.player.oil = Math.min(this.oilMax, this.eff('oil') + this.lvl('start_gear') * 15);
    this.player.tallow = 0;
    this.run.relics = [];
    this.mode = 'play';
    this.toast('The Hollow takes you in. Your tallow is scattered to the dark.', 'bad');
  }

  playerTier() {
    const d = Math.hypot(this.player.x - this.world.hub.x, this.player.y - this.world.hub.y);
    return d < 40 ? 0 : d < 80 ? 1 : 2;
  }
  inHub() {
    const d = Math.hypot(this.player.x - this.world.hub.x, this.player.y - this.world.hub.y);
    return d < this.world.hub.r;
  }

  // ---------- tide ----------
  calmTime() {
    let t = BASE.calmTime;
    if (this.meta.npcsSaved.includes('bellwright')) t += 60;
    return t;
  }
  updateTide(dt) {
    const t = this.tide;
    t.t -= dt;
    if (t.phase === 'calm') {
      if (t.t <= 10 && !t.warned) {
        t.warned = true;
        this.toast('The dark is gathering. The Umbral Tide comes.', 'warn');
        this.sfx('tide_warn');
      }
      if (t.t <= 0) {
        t.phase = 'tide'; t.t = BASE.tideTime;
        this.toast('The Umbral Tide rolls in.', 'bad');
        // spawn extra mobs from edges around player
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 8;
          const x = this.player.x + Math.cos(a) * r, y = this.player.y + Math.sin(a) * r;
          const tx = Math.floor(x), ty = Math.floor(y);
          if (!isWalkable(this.world, tx, ty)) continue;
          const kind = Math.random() < 0.6 ? 'mote' : 'stalker';
          this.run.mobs.push(makeMob(kind, x, y, this.playerTier()));
        }
      }
    } else if (t.t <= 0) {
      t.phase = 'calm'; t.t = this.calmTime(); t.warned = false;
      this.run.tidesSurvived++;
      this.toast('The tide recedes. The light held.', 'good');
    }
  }
  get tideActive() { return this.tide.phase === 'tide'; }

  // ---------- economy ----------
  addKindling(n, why) {
    n = Math.round(n * (1 + this.relicVal('kindlingBonus')));
    this.meta.kindling += n;
    this.meta.totalKindling += n;
    this.run.kindlingEarned += n;
    this.toast(`+${n} Kindling — ${why}`, 'kindling');
    this.sfx('kindling');
  }
  drainOil(n) { this.player.oil = Math.max(0, this.player.oil - n); }
  addOil(n) { this.player.oil = Math.min(this.oilMax, this.player.oil + n); }
  addTallow(n) { this.player.tallow += n; }

  renderTallow(atBeacon) {
    const t = this.player.tallow;
    if (t <= 0) { this.toast('No tallow to render.', 'bad'); return; }
    const yieldPer = atBeacon ? 2 + this.upSum('renderRatio') : BASE.cauldronYield + this.upSum('renderRatio');
    const oil = t * yieldPer;
    this.player.tallow = 0;
    this.addOil(oil);
    this.toast(`Rendered ${t} tallow into ${oil} oil.`, 'good');
    this.sfx('render_tallow');
  }

  placeBeacon() {
    if (this.run.beacons.length >= this.beaconCap) { this.toast('No more beacon frames. (upgrade beacon_cap)', 'bad'); return; }
    if (this.player.tallow < 5 || this.player.oil < 10) { this.toast('A beacon needs 5 tallow and 10 oil.', 'bad'); return; }
    const tx = Math.floor(this.player.x), ty = Math.floor(this.player.y);
    if (!isWalkable(this.world, tx, ty) || this.inHub()) { this.toast('Cannot plant here.', 'bad'); return; }
    this.player.tallow -= 5; this.player.oil -= 10;
    const b = makeBeacon(this.player.x, this.player.y);
    b.income = 0.35 + this.relicVal('oilPerSec');
    this.run.beacons.push(b);
    this.run.beaconsPlaced++;
    spark(this, b.x, b.y, '#ffd27a', 18, 3, 0.8);
    this.sfx('beacon_place');
    this.toast('Beacon planted. The dark gives ground.', 'good');
  }

  flash() {
    const p = this.player;
    if (p.flashCd > 0) return;
    if (p.oil < this.eff('flashCost') * 0 + BASE.flashCost) { this.toast('Not enough oil to Flash.', 'bad'); return; }
    p.oil -= BASE.flashCost;
    p.flashCd = BASE.flashCd;
    const r = BASE.flashRadius + this.upSum('flashRadius') + this.relicVal('flashRadius');
    const dmg = BASE.flashDmg * (1 + this.upSum('flashDmg'));
    for (const m of this.run.mobs) {
      if (dist(m, p) <= r) { this.hurtMob(m, dmg, true); m.stagger = 0.8; }
    }
    spark(this, p.x, p.y, '#fff2c0', 26, 5, 0.5);
    this.shake = 0.25;
    this.sfx('flash');
  }

  cycleFocus() {
    const order = ['white'];
    if (this.hasFocus('red')) order.push('red');
    if (this.hasFocus('gold')) order.push('gold');
    if (this.hasFocus('blue')) order.push('blue');
    const i = order.indexOf(this.focus);
    this.focus = order[(i + 1) % order.length];
    this.sfx('ui_click');
    this.toast(`Lantern focus: ${this.focus}.`, 'info');
  }

  // ---------- damage ----------
  damagePlayer(dmg, from) {
    const p = this.player;
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.4;
    this.shake = Math.max(this.shake, 0.15);
    spark(this, p.x, p.y, '#ff6b5a', 6, 2, 0.4);
    this.sfx('hurt');
    if (p.hp <= 0) this.die();
  }
  hurtMob(m, dps, burst = false) {
    m.hp -= dps;
    m.hitFlash = 0.12;
    if (burst) spark(this, m.x, m.y, '#ffd27a', 4, 2, 0.3);
    if (m.hp <= 0) this.killMob(m);
  }
  killMob(m) {
    const idx = this.run.mobs.indexOf(m);
    if (idx >= 0) this.run.mobs.splice(idx, 1);
    this.run.kills++;
    const def = m.def;
    const bonus = 1 + this.relicVal('tallowBonus') + (this.meta.npcsSaved.includes('child') ? 0.15 : 0);
    const [tmin, tmax] = def.drops.tallow;
    const tallow = Math.max(1, Math.round((tmin + Math.floor(Math.random() * (tmax - tmin + 1))) * bonus));
    for (let i = 0; i < Math.min(tallow, 6); i++) {
      this.run.drops.push(makeDrop('tallow', m.x + (Math.random() - 0.5), m.y + (Math.random() - 0.5)));
    }
    if (def.drops.oil) {
      const [omin, omax] = def.drops.oil;
      for (let i = 0; i < omin + Math.floor(Math.random() * (omax - omin + 1)); i++)
        this.run.drops.push(makeDrop('oilflask', m.x + (Math.random() - 0.5), m.y + (Math.random() - 0.5)));
    }
    spark(this, m.x, m.y, '#c8b8ff', 10, 2.5, 0.6);
    this.sfx('burn');
    if (def.boss) {
      this.run.slainKings.add(m.kind);
      if (!this.meta.kingsSlain.includes(m.kind)) this.meta.kingsSlain.push(m.kind);
      this.addKindling(def.kindling, `${def.name} unmade`);
      this.giveRandomRelic();
      this.toast(`${def.name} is unmade. The wilds shudder.`, 'kindling');
      if (this.meta.kingsSlain.length >= 3) this.mode = 'dawn';
    } else if (!this.run.respawnQueue) this.run.respawnQueue = [];
    if (!def.boss) this.run.respawnQueue.push({ t: 60 + Math.random() * 90, kind: m.kind, x: m.x, y: m.y, tier: m.tier });
  }

  giveRandomRelic() {
    if (this.run.relics.length >= 3) { this.toast('Relic slots full (3). The extra dissolves.', 'warn'); return; }
    const owned = new Set(this.run.relics.map(r => r.id));
    const pool = RELICS.filter(r => !owned.has(r.id));
    if (!pool.length) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    this.run.relics.push(r);
    this.toast(`Relic: ${r.name} — ${r.desc}`, 'kindling');
  }

  // ---------- interactions ----------
  nearestInteractable() {
    const p = this.player;
    let best = null, bd = 1.8;
    const consider = (obj, kind, label) => {
      const d = dist(obj, p);
      if (d < bd) { bd = d; best = { ref: obj, x: obj.x, y: obj.y, kind, label }; }
    };
    for (const lm of this.world.landmarks) {
      if (lm.type.startsWith('king_')) continue;
      if (this.run.discovered.has(lm.type + lm.x + ',' + lm.y)) continue;
      consider(lm, 'landmark', `Discover the ${lm.type}`);
    }
    for (const n of this.run.npcs) {
      if (n.state !== 'lost') continue;
      consider(n, 'npc', `Speak to the ${n.def.title}`);
    }
    const hp = this.hubProps;
    if (this.inHub()) {
      consider(hp.cauldron, 'cauldron', 'Render tallow into oil');
      consider(hp.altar, 'altar', 'Ember Altar (Kindling upgrades)');
    }
    for (const b of this.run.beacons) consider(b, 'beacon', 'Render tallow at beacon');
    return best;
  }

  interact() {
    const it = this.nearestInteractable();
    if (!it) return false;
    if (it.kind === 'landmark') this.discoverLandmark(it.ref);
    else if (it.kind === 'npc') this.awakenNpc(it.ref);
    else if (it.kind === 'cauldron') this.renderTallow(false);
    else if (it.kind === 'beacon') this.renderTallow(true);
    else if (it.kind === 'altar') { this.ui.altar = !this.ui.altar; this.sfx('ui_open'); }
    return true;
  }

  discoverLandmark(lm) {
    const key = lm.type + lm.x + ',' + lm.y;
    this.run.discovered.add(key);
    const gain = { shrine: 3, grove: 2, spring: 2, obelisk: 4 }[lm.type] || 2;
    this.addKindling(gain, `discovered a ${lm.type}`);
    const text = (LANDMARK_TEXT[lm.type] || [''])[0];
    if (text) this.toast(text, 'lore');
    if (lm.type === 'shrine') { this.player.hp = Math.min(this.maxHp, this.player.hp + 5); }
    if (lm.type === 'grove') this.revealAround(lm.x, lm.y, 14);
    if (lm.type === 'spring') {
      if (!this.run.springUsed.has(key)) { this.run.springUsed.add(key); this.addOil(this.oilMax); this.toast('The spring refills your lantern.', 'good'); }
    }
    if (lm.type === 'obelisk') this.giveRandomRelic();
    this.sfx('upgrade');
  }

  npcTaskDone(n) {
    const r = this.run;
    switch (n.defId) {
      case 'merchant': return r === null || this.player.tallow >= 10;
      case 'cartographer': return r.discovered.size >= 3;
      case 'gravetender': return r.beaconsPlaced >= 2;
      case 'child': return this.player.oil >= 15;
      case 'bellwright': return r.tidesSurvived >= 1;
      case 'mothkeeper': return r.kills >= 12;
      default: return true;
    }
  }

  awakenNpc(n) {
    if (!this.npcTaskDone(n)) {
      this.toast(`${n.def.name}: "${n.def.taskHint}"`, 'info');
      return;
    }
    if (n.defId === 'child') this.drainOil(15);
    n.state = 'awakened';
    this.addKindling(8, `${n.def.name} remembers the way home`);
    if (!this.meta.npcsSaved.includes(n.defId)) this.meta.npcsSaved.push(n.defId);
    const line = this.rng.pick(n.def.dialogueAwaken);
    this.toast(`${n.def.name}: "${line}"`, 'lore');
    this.sfx('npc_awaken');
  }

  // ---------- fog ----------
  revealAround(x, y, r) {
    const w = this.world;
    for (let ty = Math.max(0, Math.floor(y - r)); ty < Math.min(w.H, y + r); ty++)
      for (let tx = Math.max(0, Math.floor(x - r)); tx < Math.min(w.W, x + r); tx++)
        if (Math.hypot(tx - x, ty - y) <= r) this.fog[ty * w.W + tx] = 1;
  }
  revealRandomFog(r) {
    const x = this.rng.int(0, this.world.W), y = this.rng.int(0, this.world.H);
    this.revealAround(x, y, r);
  }

  // ---------- toasts / sfx hook ----------
  toast(text, kind = 'info') {
    this.toasts.push({ text, kind, t: 0, life: kind === 'lore' ? 8 : 5 });
    if (this.toasts.length > 6) this.toasts.shift();
  }
  sfx(name) { if (this._sfx) this._sfx(name); }

  // ---------- main update ----------
  update(dt, input) {
    if (this.mode !== 'play') return;
    this.time += dt;
    const p = this.player;
    const menuOpen = this.ui.altar || this.ui.merchant;

    // player movement
    let mx = 0, my = 0;
    if (!menuOpen) {
      if (input.left) mx -= 1; if (input.right) mx += 1;
      if (input.up) my -= 1; if (input.down) my += 1;
    }
    const ml = Math.hypot(mx, my);
    p.moving = ml > 0;
    if (ml > 0) {
      mx /= ml; my /= ml;
      const sp = this.speed;
      // entities.moveCircle via import
      this._movePlayer(mx * sp * dt, my * sp * dt);
      if (Math.abs(mx) > Math.abs(my)) p.facing = mx > 0 ? 'side' : 'side';
      p.facing = my < -0.3 ? 'up' : my > 0.3 ? 'down' : p.facing === 'up' || p.facing === 'down' ? p.facing : 'side';
      p.animT += dt;
      p.stepT = (p.stepT || 0) + dt;
      if (p.stepT > 0.34) {
        p.stepT = 0; this.sfx('step');
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + 0.3,
          vx: -mx * 0.5, vy: -0.2, life: 0.35, max: 0.35, color: '#3a342a', size: 1 });
      }
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.flashCd > 0) p.flashCd -= dt;

    // oil burn
    const tier = this.playerTier();
    let burn = BASE.burn * (tier === 2 ? 1.5 : 1);
    if (this.tideActive) burn *= (2 - this.lvl('tide_resist') * 0.12);
    if (this.focus === 'blue') burn *= 0.6;
    p.oil = Math.max(0, p.oil - burn * dt);

    // beacon income (incremental heartbeat)
    let income = 0;
    for (const b of this.run.beacons) { b.age += dt; b.pulse += dt; income += b.income; }
    if (income > 0) this._oilAcc = (this._oilAcc || 0) + income * dt;
    if ((this._oilAcc || 0) >= 1) { const n = Math.floor(this._oilAcc); this.addOil(n); this._oilAcc -= n; }

    // out-of-light penalties
    const lit = this.light.at(p.x, p.y);
    if (p.oil <= 0 && lit < 0.2 && !this.inHub()) {
      this._umbralTick = (this._umbralTick || 0) + dt;
      if (this._umbralTick >= 1) { this._umbralTick = 0; this.damagePlayer(1, null); this.toast('The Umbral touches you.', 'bad'); }
    }
    // wick mending regen
    const regen = this.lvl('wick_mending') * 0.5;
    if (regen > 0 && lit > 0.5 && p.hp < this.maxHp) p.hp = Math.min(this.maxHp, p.hp + regen * dt);

    // tide
    this.updateTide(dt);

    // light field
    this.light.clear();
    const lr = p.oil > 0 ? this.lightRadius : 2;
    this.light.add(p.x, p.y, lr, 1);
    for (const b of this.run.beacons) this.light.add(b.x, b.y, b.radius, 0.9);
    if (this.inHub()) this.light.add(this.world.hub.x, this.world.hub.y, this.world.hub.r + 4, 1);

    // fog reveal around player
    this.revealAround(p.x, p.y, lr);

    // mobs
    for (const m of [...this.run.mobs]) {
      updateMob(m, dt, this);
      // light burn
      const l = this.light.at(m.x, m.y);
      if (l > 0.15 && p.oil > 0) {
        const dps = this.burnDps * (m.def.burnWeak || 1) * l;
        this.hurtMob(m, dps * dt, false);
        if (Math.random() < dt * 2) spark(this, m.x, m.y, '#ffb347', 1, 1, 0.3, 1);
      }
    }

    // NPC passives
    p.noticeMul = this.meta.npcsSaved.includes('mothkeeper') ? 0.6 : 1;
    // Grave-tender: slow mending while you stand in the Hollow
    if (this.meta.npcsSaved.includes('gravetender') && this.inHub() && p.hp < this.maxHp) {
      p.hp = Math.min(this.maxHp, p.hp + 1.5 * dt);
    }
    // Gold lens: uncovers hidden caches near you
    if (this.focus === 'gold') {
      this._goldT = (this._goldT || 0) + dt;
      if (this._goldT > 6) {
        this._goldT = 0;
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 6;
        const cx = p.x + Math.cos(a) * r, cy = p.y + Math.sin(a) * r;
        if (isWalkable(this.world, Math.floor(cx), Math.floor(cy))) {
          this.run.drops.push(makeDrop(Math.random() < 0.7 ? 'tallow' : 'oilflask', cx, cy));
          spark(this, cx, cy, '#ffd27a', 5, 1.5, 0.6);
        }
      }
    }

    // npcs
    for (const n of this.run.npcs) updateNpc(n, dt, this);

    // drops pickup
    for (let i = this.run.drops.length - 1; i >= 0; i--) {
      const d = this.run.drops[i];
      d.t += dt;
      if (dist(d, p) < 0.8) {
        if (d.kind === 'tallow') { this.addTallow(1); this.sfx('pickup'); }
        else if (d.kind === 'oilflask') { this.addOil(5); this.sfx('pickup'); }
        else if (d.kind === 'kindling') { this.addKindling(1, 'a cold spark'); }
        this.run.drops.splice(i, 1);
      } else if (d.t > 90) this.run.drops.splice(i, 1);
    }

    // child trinkets
    if (this.meta.npcsSaved.includes('child') && Math.random() < dt * 0.02 && p.moving) {
      this.run.drops.push(makeDrop('tallow', p.x + (Math.random() - 0.5) * 3, p.y + (Math.random() - 0.5) * 3));
    }

    // respawn queue
    if (this.run.respawnQueue.length) {
      for (let i = this.run.respawnQueue.length - 1; i >= 0; i--) {
        const rq = this.run.respawnQueue[i];
        rq.t -= dt;
        if (rq.t <= 0) {
          this.run.respawnQueue.splice(i, 1);
          if (Math.hypot(rq.x - p.x, rq.y - p.y) > 20) {
            this.run.mobs.push(makeMob(rq.kind, rq.x, rq.y, rq.tier));
          } else this.run.respawnQueue.push({ ...rq, t: 30 });
        }
      }
    }

    updateParticles(this, dt);
    // ambient embers drifting off the lantern
    if (p.oil > 0 && Math.random() < dt * 4) {
      this.particles.push({ x: p.x + (Math.random() - 0.5) * 0.6, y: p.y - 0.3 + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.3, life: 1.2, max: 1.2, color: '#8a6a3a', size: 1 });
    }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < t.life);
    if (this.shake > 0) this.shake -= dt;
  }

  _movePlayer(dx, dy) {
    // local import to avoid circulars
    const { moveCircle } = this._ent;
    moveCircle(this.world, this.player, dx, dy, 0.32);
  }
  setEntities(mod) { this._ent = mod; }
}
