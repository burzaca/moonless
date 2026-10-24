// MOONLESS — renderer: tiles, light mask, fog, sprites, particles, HUD, menus.

import { T } from './rng.js';
import { getSprite } from './sprites.js';
import { UPGRADES } from './data.js';

const S = 3;               // pixel scale
const TS = 16 * S;         // tile size on screen

const TILE_COLORS = {
  [T.GRASS]:     ['#1d2b1e', '#20301f', '#1a281c'],
  [T.TALLGRASS]: ['#243a24', '#274026', '#213722'],
  [T.DIRT]:      ['#33291d', '#372d20', '#2f261b'],
  [T.SAND]:      ['#4a4432', '#4f4936', '#453f2e'],
  [T.WATER]:     ['#101d33', '#122139', '#0e1a2e'],
  [T.ASH]:       ['#232329', '#26262c', '#202026'],
  [T.RUIN_FLOOR]:['#26262e', '#292931', '#23232b'],
  [T.RUIN_WALL]: ['#3d3d48', '#42424d', '#383843'],
  [T.HUB_FLOOR]: ['#3f3628', '#443a2b', '#3a3225'],
  [T.HUB_WALL]:  ['#57492f', '#5c4e34', '#52442c'],
  [T.BRIDGE]:    ['#4a3a26', '#4f3f2a', '#453623'],
  [T.PINE]:      ['#101c15', '#121f17', '#0e1a13'],
  [T.DEADTREE]:  ['#1e231e', '#212621', '#1b201b'],
  [T.ROCK]:      ['#31323a', '#34353d', '#2e2f37'],
  [T.VOID]:      ['#05060a'],
};

function tileHash(x, y) {
  let h = (x * 73856093 ^ y * 19349663) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const spriteCache = new Map();
export function spriteCanvas(name) {
  if (spriteCache.has(name)) return spriteCache.get(name);
  const sp = getSprite(name);
  if (!sp) return null;
  const c = document.createElement('canvas');
  c.width = sp.w; c.height = sp.h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < sp.h; y++) {
    const row = sp.rows[y] || '';
    for (let x = 0; x < sp.w; x++) {
      const ch = row[x] || '.';
      if (ch === '.') continue;
      const col = sp.palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  spriteCache.set(name, c);
  return c;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  drawSprite(name, wx, wy, cam, flip = false) {
    const sc = spriteCanvas(name);
    if (!sc) return;
    const sx = Math.round((wx - 0.5) * TS - cam.x * TS);
    const sy = Math.round((wy - 0.5) * TS - cam.y * TS) - (sc.height - 16) * S;
    const dw = sc.width * S, dh = sc.height * S;
    const x = sx + (16 * S - dw) / 2, y = sy + (16 * S - dh);
    this.ctx.save();
    if (flip) {
      this.ctx.translate(x + dw, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(sc, 0, 0, sc.width, sc.height, 0, 0, dw, dh);
    } else {
      this.ctx.drawImage(sc, x, y, dw, dh);
    }
    this.ctx.restore();
  }

  frame(dt) {
    const g = this.game, ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);

    if (g.mode === 'title') { this.drawTitle(); return; }

    const p = g.player;
    const cam = {
      x: p.x - (W / TS) / 2 + (Math.random() - 0.5) * (g.shake > 0 ? 0.15 : 0),
      y: p.y - (H / TS) / 2 + (Math.random() - 0.5) * (g.shake > 0 ? 0.15 : 0),
    };
    const vx0 = Math.floor(cam.x) - 1, vy0 = Math.floor(cam.y) - 1;
    const vx1 = Math.ceil(cam.x + W / TS) + 1, vy1 = Math.ceil(cam.y + H / TS) + 1;
    const world = g.world;

    // ---- tiles ----
    for (let ty = Math.max(0, vy0); ty < Math.min(world.H, vy1); ty++) {
      for (let tx = Math.max(0, vx0); tx < Math.min(world.W, vx1); tx++) {
        const idx = ty * world.W + tx;
        if (!g.fog[idx]) continue;
        const t = world.tiles[idx];
        const cols = TILE_COLORS[t] || TILE_COLORS[T.VOID];
        const h = tileHash(tx, ty);
        ctx.fillStyle = cols[Math.floor(h * cols.length) % cols.length];
        const sx = Math.round((tx - cam.x) * TS), sy = Math.round((ty - cam.y) * TS);
        ctx.fillRect(sx, sy, TS + 1, TS + 1);
        // texture accents
        if (t === T.TALLGRASS) {
          ctx.fillStyle = '#35502f';
          for (let i = 0; i < 3; i++) {
            const gx = sx + ((h * 977 + i * 37) % TS), gy = sy + ((h * 613 + i * 53) % TS);
            ctx.fillRect(gx, gy, S, S * 2);
          }
        } else if (t === T.GRASS && h > 0.72) {
          ctx.fillStyle = '#2c4229';
          const gx = sx + (h * 911 % (TS - S * 2)) | 0, gy = sy + (h * 577 % (TS - S * 2)) | 0;
          ctx.fillRect(gx, gy, S, S * 2);
          ctx.fillRect(gx + S * 2, gy + S, S, S);
        } else if (t === T.DIRT && h > 0.8) {
          ctx.fillStyle = '#241c12';
          ctx.fillRect(sx + (h * 733 % TS) | 0, sy + (h * 397 % TS) | 0, S * 2, S);
        } else if (t === T.SAND && h > 0.65) {
          ctx.fillStyle = '#565040';
          ctx.fillRect(sx + (h * 619 % (TS - S * 3)) | 0, sy + (h * 431 % TS) | 0, S * 3, S);
        } else if (t === T.HUB_FLOOR) {
          ctx.fillStyle = '#332b1f';
          ctx.fillRect(sx, sy + TS - S, TS, S);
          if (h > 0.6) ctx.fillRect(sx + (h * 823 % TS) | 0, sy, S, TS);
        } else if (t === T.WATER) {
          const ph = Math.sin(g.time * 1.6 + tx * 0.7 + ty * 0.9);
          if (ph > 0.55) { ctx.fillStyle = '#28446b'; ctx.fillRect(sx + TS * 0.2, sy + TS * 0.5, TS * 0.5, S); }
        } else if (t === T.RUIN_WALL) {
          ctx.fillStyle = '#2c2c34';
          ctx.fillRect(sx, sy + TS / 2, TS, S);
          ctx.fillRect(sx + TS / 2, sy, S, TS / 2);
        } else if (t === T.HUB_WALL) {
          ctx.fillStyle = '#3a3227';
          ctx.fillRect(sx, sy + TS * 0.6, TS, S);
        } else if (t === T.BRIDGE) {
          ctx.fillStyle = '#33291c';
          ctx.fillRect(sx, sy + TS * 0.3, TS, S);
          ctx.fillRect(sx, sy + TS * 0.7, TS, S);
        } else if (t === T.PINE) {
          this.drawSprite('tree_pine', tx + 0.5, ty + 0.5, cam);
        } else if (t === T.DEADTREE) {
          this.drawSprite('tree_dead', tx + 0.5, ty + 0.5, cam);
        } else if (t === T.ROCK) {
          this.drawSprite('rock', tx + 0.5, ty + 0.5, cam);
        }
      }
    }

    // ---- landmarks ----
    for (const lm of world.landmarks) {
      if (!g.fog[Math.floor(lm.y) * world.W + Math.floor(lm.x)]) continue;
      const name = { shrine: 'shrine', obelisk: 'obelisk', spring: 'spring', grove: 'grove_marker',
        king_stag: 'obelisk', king_choir: 'obelisk', king_hollow: 'obelisk' }[lm.type];
      if (name) this.drawSprite(name, lm.x + 0.5, lm.y + 0.5, cam);
    }

    // ---- hub props ----
    if (g.hubProps) {
      const hp = g.hubProps;
      if (g.fog[Math.floor(hp.cauldron.y) * world.W + Math.floor(hp.cauldron.x)]) {
        this.drawSprite('cauldron', hp.cauldron.x, hp.cauldron.y, cam);
        this.drawSprite('banner', hp.banner.x, hp.banner.y, cam);
        this.drawAltar(hp.altar, cam);
      }
    }

    // ---- beacons ----
    for (const b of g.run.beacons) {
      this.drawSprite(b.lit ? 'beacon_lit' : 'beacon', b.x, b.y, cam);
      const pulse = 0.5 + 0.5 * Math.sin(b.pulse * 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient((b.x - cam.x) * TS, (b.y - cam.y) * TS, 2, (b.x - cam.x) * TS, (b.y - cam.y) * TS, b.radius * TS);
      grad.addColorStop(0, `rgba(255,170,60,${0.10 + 0.05 * pulse})`);
      grad.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ---- drops ----
    for (const d of g.run.drops) {
      const bob = Math.sin(g.time * 3 + d.bob) * 2;
      const sc = spriteCanvas(d.kind === 'tallow' ? 'tallow' : d.kind === 'oilflask' ? 'oilflask' : 'kindling');
      if (!sc) continue;
      const sx = (d.x - cam.x) * TS - sc.width * S / 2, sy = (d.y - cam.y) * TS - sc.height * S / 2 + bob;
      ctx.drawImage(sc, sx, sy, sc.width * S, sc.height * S);
    }

    // ---- npcs ----
    for (const n of g.run.npcs) {
      if (!g.fog[Math.floor(n.y) * world.W + Math.floor(n.x)]) continue;
      this.drawSprite('npc_' + n.defId, n.x, n.y, cam);
      if (n.state === 'lost') {
        // faint cold flicker
        ctx.fillStyle = `rgba(140,170,255,${0.25 + 0.15 * Math.sin(g.time * 5 + n.id)})`;
        ctx.fillRect((n.x - cam.x) * TS - S, (n.y - cam.y) * TS - 18 * S, S * 2, S * 2);
      }
    }

    // ---- mobs ----
    for (const m of g.run.mobs) {
      if (!g.fog[Math.floor(m.y) * world.W + Math.floor(m.x)]) continue;
      const lit = g.light.at(m.x, m.y);
      if (lit < 0.06 && !m.def.boss) continue; // invisible in the dark
      this.drawSprite(m.kind, m.x, m.y, cam, m.x > p.x);
      if (m.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,220,150,0.5)';
        ctx.fillRect((m.x - cam.x) * TS - 8 * S, (m.y - cam.y) * TS - 8 * S, 16 * S, 16 * S);
        ctx.restore();
      }
      if (m.def.boss || m.hp < m.maxHp) {
        const bw = m.def.boss ? 24 * S : 12 * S;
        const bx = (m.x - cam.x) * TS - bw / 2, by = (m.y - cam.y) * TS - (m.def.boss ? 20 : 12) * S;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, 3 * S);
        ctx.fillStyle = m.def.boss ? '#c86bff' : '#e05b4e';
        ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), 3 * S);
      }
    }

    // ---- player ----
    {
      const p2 = g.player;
      let frame = 1;
      if (p2.moving) frame = 1 + (Math.floor(p2.animT * 8) % 2);
      const dir = p2.facing === 'side' ? 'side' : p2.facing;
      this.drawSprite(`player_${dir}${frame}`, p2.x, p2.y, cam, p2._flip === -1);
      // lantern glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lr = (p2.oil > 0 ? g.lightRadius : 2) * TS;
      const grad = ctx.createRadialGradient((p2.x - cam.x) * TS, (p2.y - cam.y) * TS, 4, (p2.x - cam.x) * TS, (p2.y - cam.y) * TS, lr);
      const glowCol = { white: '255,190,110', red: '255,110,80', gold: '255,215,120', blue: '120,180,255' }[g.focus] || '255,190,110';
      grad.addColorStop(0, `rgba(${glowCol},0.16)`);
      grad.addColorStop(1, `rgba(${glowCol},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ---- particles ----
    for (const pt of g.particles) {
      const a = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.fillRect((pt.x - cam.x) * TS, (pt.y - cam.y) * TS, pt.size * S, pt.size * S);
    }
    ctx.globalAlpha = 1;

    // ---- smooth darkness layer with gradient light holes ----
    {
      const maxDark = g.tideActive ? 0.96 : 0.9;
      if (!this.dark || this.dark.width !== W || this.dark.height !== H) {
        this.dark = document.createElement('canvas');
        this.dark.width = W; this.dark.height = H;
        this.dctx = this.dark.getContext('2d');
      }
      const d = this.dctx;
      d.clearRect(0, 0, W, H);
      d.fillStyle = `rgba(3,4,9,${maxDark})`;
      d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      const punch = (wx, wy, radius, strength) => {
        const cx = (wx - cam.x) * TS, cy = (wy - cam.y) * TS, r = radius * TS;
        const grad = d.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
        grad.addColorStop(0, `rgba(0,0,0,${strength})`);
        grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.85})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = grad;
        d.beginPath(); d.arc(cx, cy, r, 0, Math.PI * 2); d.fill();
      };
      punch(g.player.x, g.player.y, (g.player.oil > 0 ? g.lightRadius : 2) * 1.15, 1);
      for (const b of g.run.beacons) punch(b.x, b.y, b.radius * 1.2, 0.95);
      if (g.inHub()) punch(g.world.hub.x, g.world.hub.y, (g.world.hub.r + 5) * 1.1, 1);
      for (const lm of g.world.landmarks) {
        if (lm.type === 'spring' && g.fog[Math.floor(lm.y) * g.world.W + Math.floor(lm.x)]) punch(lm.x + 0.5, lm.y + 0.5, 3.5, 0.5);
      }
      d.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(this.dark, 0, 0);
    }

    // ---- interact prompt ----
    const it = g.nearestInteractable();
    if (it && g.mode === 'play') {
      const sx = (it.x - cam.x) * TS, sy = (it.y - cam.y) * TS - 22 * S;
      ctx.font = `${10 * S}px monospace`;
      ctx.textAlign = 'center';
      const label = `[E] ${it._label}`;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(8,9,14,0.85)';
      ctx.fillRect(sx - w / 2, sy - 10 * S, w, 12 * S);
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(label, sx, sy - 1 * S);
      ctx.textAlign = 'left';
    }

    // ---- HUD ----
    this.drawHUD();
    // ---- tide atmosphere: cold violet vignette ----
    if (g.tideActive) {
      const pulse = 0.10 + 0.04 * Math.sin(g.time * 2);
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(80,40,120,0)');
      vg.addColorStop(1, `rgba(60,25,90,${pulse + 0.12})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    // ---- toasts ----
    this.drawToasts();
    // ---- menus / overlays ----
    if (g.ui.altar) this.drawAltarMenu();
    if (g.ui.merchant) this.drawMerchantMenu();
    if (g.ui.help) this.drawHelp();
    if (g.mode === 'dead') this.drawDeath();
    if (g.mode === 'dawn') this.drawDawn();
    if (g.ui.minimap) this.drawMinimap();
  }

  drawAltar(pos, cam) {
    const ctx = this.ctx;
    const sx = (pos.x - cam.x) * TS, sy = (pos.y - cam.y) * TS;
    ctx.fillStyle = '#4a4034';
    ctx.fillRect(sx - 6 * S, sy - 14 * S, 12 * S, 16 * S);
    ctx.fillStyle = '#2c2620';
    ctx.fillRect(sx - 4 * S, sy - 12 * S, 8 * S, 12 * S);
    const fl = 0.6 + 0.4 * Math.sin(this.game.time * 6);
    ctx.fillStyle = `rgba(255,${150 + 60 * fl},80,${0.8})`;
    ctx.fillRect(sx - 2 * S, sy - 10 * S, 4 * S, 4 * S);
    ctx.fillStyle = `rgba(255,220,140,${0.5 * fl})`;
    ctx.fillRect(sx - S, sy - 12 * S, 2 * S, 2 * S);
  }

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,11,16,0.93)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#5a4c33';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  drawHUD() {
    const g = this.game, ctx = this.ctx;
    const pad = 14, bw = 220, bh = 14;
    // HP
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pad, pad, bw, bh);
    ctx.fillStyle = '#c0453c';
    ctx.fillRect(pad, pad, bw * Math.max(0, g.player.hp / g.maxHp), bh);
    ctx.strokeStyle = '#6b3a34'; ctx.strokeRect(pad, pad, bw, bh);
    // Oil
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pad, pad + 20, bw, bh);
    const oilCol = g.focus === 'blue' ? '#5f8fd4' : g.focus === 'red' ? '#d4674f' : g.focus === 'gold' ? '#d4a94f' : '#d9a441';
    ctx.fillStyle = oilCol;
    ctx.fillRect(pad, pad + 20, bw * (g.player.oil / g.oilMax), bh);
    ctx.strokeStyle = '#6b5a34'; ctx.strokeRect(pad, pad + 20, bw, bh);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#e8e2d0';
    ctx.fillText(`oil ${Math.floor(g.player.oil)}/${g.oilMax}   hp ${Math.ceil(g.player.hp)}/${g.maxHp}`, pad + 2, pad + 20 + bh + 16);
    ctx.fillText(`tallow ${g.player.tallow}   kindling ${g.meta.kindling}   beacons ${g.run.beacons.length}/${g.beaconCap}`, pad + 2, pad + 20 + bh + 32);
    ctx.fillText(`focus: ${g.focus.toUpperCase()}   kills ${g.run.kills}   ${g.meta.kingsSlain.length}/3 kings`, pad + 2, pad + 20 + bh + 48);
    // tide clock
    const t = g.tide;
    const label = t.phase === 'calm' ? `tide in ${Math.ceil(t.t)}s` : `TIDE ${Math.ceil(t.t)}s`;
    ctx.fillStyle = t.phase === 'calm' ? (t.t < 15 ? '#e0a04e' : '#8a8577') : '#c86bff';
    ctx.fillText(label, ctx.canvas.width - 150, pad + 12);
    // relics
    let rx = pad;
    for (const r of g.run.relics) {
      ctx.fillStyle = 'rgba(200,107,255,0.25)';
      ctx.fillRect(rx, ctx.canvas.height - 40, 120, 22);
      ctx.fillStyle = '#d9b8ff';
      ctx.fillText(r.name, rx + 4, ctx.canvas.height - 24);
      rx += 128;
    }
  }

  drawToasts() {
    const g = this.game, ctx = this.ctx;
    const cols = { info: '#cfc8b8', good: '#9fd08f', bad: '#e07a6a', warn: '#e0b04e', kindling: '#c86bff', lore: '#8fb8d0' };
    let y = ctx.canvas.height - 70;
    ctx.font = '13px monospace';
    for (const t of [...g.toasts].reverse()) {
      const a = Math.min(1, (t.life - t.t) / 1.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,9,14,0.8)';
      const w = ctx.measureText(t.text).width + 16;
      ctx.fillRect(12, y - 14, w, 20);
      ctx.fillStyle = cols[t.kind] || cols.info;
      ctx.fillText(t.text, 20, y);
      y -= 24;
    }
    ctx.globalAlpha = 1;
  }

  drawTitle() {
    const ctx = this.ctx, W = ctx.canvas.width, H = ctx.canvas.height;
    const t = this.game.time;
    // starfield-ish drifting motes
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137 + t * (10 + i % 7)) % W), y = ((i * 211 + t * (4 + i % 5)) % H);
      ctx.fillStyle = `rgba(255,200,120,${0.05 + 0.05 * Math.sin(t + i)})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 64px monospace';
    ctx.fillText('MOONLESS', W / 2, H * 0.34);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#a89f8a';
    ctx.fillText('carry the last light', W / 2, H * 0.34 + 34);
    ctx.fillStyle = `rgba(232,226,208,${0.5 + 0.5 * Math.sin(t * 3)})`;
    ctx.fillText('press any key to wake', W / 2, H * 0.55);
    ctx.fillStyle = '#6f6a5c';
    ctx.font = '12px monospace';
    ctx.fillText('WASD move · E interact · SPACE flash · B beacon · R render · Q focus · H help · M map', W / 2, H * 0.62);
    ctx.fillText(`seed ${this.game.seed} · a night-build by Anakin`, W / 2, H * 0.66);
    ctx.textAlign = 'left';
  }

  drawDeath() {
    const ctx = this.ctx, W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(3,4,8,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c0453c';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('THE DARK TAKES YOU', W / 2, H * 0.35);
    ctx.fillStyle = '#a89f8a';
    ctx.font = '15px monospace';
    ctx.fillText(this.game.deathTip || '', W / 2, H * 0.42);
    ctx.fillStyle = '#8a8577';
    ctx.fillText(`run: +${this.game.run.kindlingEarned} kindling · ${this.game.run.kills} unmade · ${this.game.run.beaconsPlaced} beacons`, W / 2, H * 0.47);
    ctx.fillStyle = `rgba(232,226,208,${0.5 + 0.5 * Math.sin(this.game.time * 3)})`;
    ctx.fillText('press ENTER to wake at the Hollow', W / 2, H * 0.56);
    ctx.textAlign = 'left';
  }

  drawDawn() {
    const ctx = this.ctx, W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(20,14,6,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 44px monospace';
    ctx.fillText('THE THREE KINGS ARE UNMADE', W / 2, H * 0.35);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '16px monospace';
    ctx.fillText('The Umbral breaks. Somewhere, a moon remembers how to rise.', W / 2, H * 0.42);
    ctx.fillStyle = '#8a8577';
    ctx.fillText('press ENTER to keep walking the light (free play)', W / 2, H * 0.52);
    ctx.textAlign = 'left';
  }

  drawAltarMenu() {
    const g = this.game, ctx = this.ctx;
    const W = ctx.canvas.width;
    const w = 640, h = 460, x = (W - w) / 2, y = 60;
    this.panel(x, y, w, h);
    ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 18px monospace';
    ctx.fillText('EMBER ALTAR — spend Kindling', x + 20, y + 30);
    ctx.fillStyle = '#a89f8a'; ctx.font = '13px monospace';
    ctx.fillText(`kindling: ${g.meta.kindling}   [1-9] buy   [ESC] close`, x + 20, y + 52);
    let yy = y + 80;
    g.ui.altarList = [];
    for (let i = 0; i < UPGRADES.length && i < 12; i++) {
      const u = UPGRADES[i];
      const lvl = g.lvl(u.id);
      const maxed = lvl >= u.maxLevel;
      const cost = Math.round(u.cost * Math.pow(1.6, lvl));
      const afford = g.meta.kindling >= cost;
      g.ui.altarList.push({ u, cost, maxed });
      ctx.fillStyle = maxed ? '#5a564c' : afford ? '#cfc8b8' : '#7a756a';
      ctx.fillText(`[${i + 1}] ${u.name}  Lv${lvl}/${u.maxLevel}  ${maxed ? 'MAX' : cost + 'k'}`, x + 20, yy);
      ctx.fillStyle = '#6f6a5c';
      ctx.fillText(`    ${u.desc}`, x + 20, yy + 15);
      yy += 32;
    }
  }

  drawMerchantMenu() {
    const g = this.game, ctx = this.ctx;
    const W = ctx.canvas.width;
    const w = 460, h = 220, x = (W - w) / 2, y = 100;
    this.panel(x, y, w, h);
    ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 16px monospace';
    ctx.fillText('THE WICK MERCHANT', x + 20, y + 28);
    ctx.fillStyle = '#a89f8a'; ctx.font = '13px monospace';
    ctx.fillText('"Tallow for oil, oil for kindling. No refunds from the dark."', x + 20, y + 50);
    ctx.fillStyle = '#cfc8b8';
    ctx.fillText('[1] 3 tallow -> 12 oil', x + 20, y + 84);
    ctx.fillText('[2] 6 tallow -> 1 kindling', x + 20, y + 106);
    ctx.fillText('[ESC] leave', x + 20, y + 128);
    ctx.fillStyle = '#6f6a5c';
    ctx.fillText(`you carry: ${g.player.tallow} tallow`, x + 20, y + 160);
  }

  drawHelp() {
    const ctx = this.ctx, W = ctx.canvas.width;
    const w = 560, h = 330, x = (W - w) / 2, y = 80;
    this.panel(x, y, w, h);
    ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 16px monospace';
    ctx.fillText('HOW THE LIGHT WORKS', x + 20, y + 28);
    ctx.fillStyle = '#cfc8b8'; ctx.font = '13px monospace';
    const lines = [
      'WASD/arrows — move        E — interact (landmarks, souls, cauldron, altar)',
      'SPACE — Flash: burst of light, costs oil, burns nearby Umbral things',
      'B — plant a Beacon (5 tallow + 10 oil): light, safety, +oil/sec',
      'R — render carried tallow into oil (at cauldron or lit beacon)',
      'Q — cycle lantern focus (unlock at the Altar)',
      'M — map   H — this help   ESC — close menus',
      '',
      'Your light burns Umbral things that touch it. Oil feeds the flame;',
      'the deep dark burns oil faster. At zero oil, the Umbral starts taking you.',
      'Death returns you to the Hollow — carried tallow is lost, Kindling is kept.',
      'Find the six lost souls. Light them. Help them home. They will help you.',
      'Three Umbral Kings wait at the edges of the world.',
    ];
    let yy = y + 54;
    for (const l of lines) { ctx.fillText(l, x + 20, yy); yy += 20; }
  }

  drawTouchControls(touch, buttons) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.35;
    if (touch.active) {
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(touch.ox, touch.oy, 46, 0, Math.PI * 2); ctx.stroke();
      const dx = touch.cx - touch.ox, dy = touch.cy - touch.oy, l = Math.hypot(dx, dy) || 1;
      const k = Math.min(l, 40);
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(touch.ox + dx / l * k, touch.oy + dy / l * k, 16, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of buttons) {
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8e2d0'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x, b.y + 4);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawMinimap() {
    const g = this.game, ctx = this.ctx;
    const size = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.5;
    const px = size / g.world.W;
    const x0 = (ctx.canvas.width - size) / 2, y0 = (ctx.canvas.height - size) / 2;
    ctx.fillStyle = 'rgba(5,6,10,0.9)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    for (let ty = 0; ty < g.world.H; ty += 2) {
      for (let tx = 0; tx < g.world.W; tx += 2) {
        if (!g.fog[ty * g.world.W + tx]) continue;
        const t = g.world.tiles[ty * g.world.W + tx];
        ctx.fillStyle = t === 0 ? '#0a0b10' : t === 4 ? '#1c3050' : t === 10 || t === 11 ? '#8a7a55' : '#3a4a3a';
        ctx.fillRect(x0 + tx * px, y0 + ty * px, px * 2, px * 2);
      }
    }
    for (const b of g.run.beacons) { ctx.fillStyle = '#ffb347'; ctx.fillRect(x0 + b.x * px - 1, y0 + b.y * px - 1, 3, 3); }
    for (const lm of g.world.landmarks) {
      const key = lm.type + lm.x + ',' + lm.y;
      const known = g.run.discovered.has(key) || g.meta.npcsSaved.includes('cartographer');
      if (!known) continue;
      ctx.fillStyle = lm.type.startsWith('king_') ? '#c86bff' : '#8fb8d0';
      ctx.fillRect(x0 + lm.x * px - 1, y0 + lm.y * px - 1, 3, 3);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + g.player.x * px - 1, y0 + g.player.y * px - 1, 3, 3);
  }
}
