// MOONLESS — bootstrap: input, loop, menus, save hooks.

import { Game } from './engine.js';
import { Renderer } from './render.js';
import * as entities from './entities.js';
import { loadMeta, saveMeta, defaultMeta, wipeMeta, saveRun, loadRun, wipeRun, hasRunSave } from './save.js';
import { SFX } from './audio.js';

const canvas = document.getElementById('game');

const meta = loadMeta() || defaultMeta();
const params = new URLSearchParams(location.search);
let seed;
if (params.get('seed')) seed = (parseInt(params.get('seed'), 10) >>> 0);
else if (params.get('daily')) { const d = new Date(); seed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0; }
else seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
const game = new Game(meta, seed);
game.setEntities(entities);
game._sfx = (n) => SFX.play(n);
const renderer = new Renderer(canvas, game);
window.MOON = game; // debug handle

const input = { left: false, right: false, up: false, down: false };

// ---------- touch controls (virtual joystick + action buttons) ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const touch = { active: false, ox: 0, oy: 0, cx: 0, cy: 0, id: null };
const TOUCH_BUTTONS = [
  { key: 'E', label: 'act', dx: -110, dy: -20 },
  { key: 'SPACE', label: 'flash', dx: -30, dy: -95 },
  { key: 'B', label: 'beacon', dx: -190, dy: -95 },
  { key: 'MENU', label: 'menu', dx: -190, dy: -20 },
];
function buttonPositions() {
  const W = canvas.width, H = canvas.height;
  return TOUCH_BUTTONS.map(b => ({ ...b, x: W + b.dx, y: H + b.dy }));
}
if (isTouch) {
  canvas.addEventListener('touchstart', (e) => {
    if (game.mode === 'title') { startPlaying(); return; }
    if (game.mode === 'dead') { game.respawn(); saveMeta(game.meta); return; }
    if (game.mode === 'dawn') { game.mode = 'play'; return; }
    for (const t of e.changedTouches) {
      const btn = buttonPositions().find(b => Math.hypot(t.clientX - b.x, t.clientY - b.y) < 45);
      if (btn) {
        if (btn.key === 'MENU') { game.ui.menu = !game.ui.menu; game.sfx('ui_click'); continue; }
        if (game.ui.menu) continue; // action buttons ignored while the menu is open
        if (btn.key === 'E') game.interact();
        else if (btn.key === 'SPACE') game.flash();
        else if (btn.key === 'B') game.placeBeacon();
        continue;
      }
      if (!touch.active && t.clientX < window.innerWidth * 0.55) {
        touch.active = true; touch.id = t.identifier;
        touch.ox = touch.cx = t.clientX; touch.oy = touch.cy = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.id) { touch.cx = t.clientX; touch.cy = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.id) { touch.active = false; touch.id = null; }
    }
  });
}
function applyTouchInput() {
  input.left = input.right = input.up = input.down = false;
  if (!touch.active) return;
  const dx = touch.cx - touch.ox, dy = touch.cy - touch.oy;
  if (Math.hypot(dx, dy) < 18) return;
  input.left = dx < -10; input.right = dx > 10; input.up = dy < -10; input.down = dy > 10;
}

function startPlaying() {
  game.mode = 'play';
  game.toast('You wake at the Hollow. The lantern is lit. For now.', 'lore');
  SFX.startAmbient();
}

function buyUpgrade(entry) {
  const { u, cost, maxed } = entry;
  if (maxed || game.meta.kindling < cost) { game.sfx('ui_click'); return; }
  game.meta.kindling -= cost;
  game.meta.upgrades[u.id] = (game.meta.upgrades[u.id] || 0) + 1;
  game.sfx('upgrade');
  game.toast(`The Altar accepts. ${u.name} strengthened.`, 'kindling');
  saveMeta(game.meta);
}

function merchantTrade(n) {
  const p = game.player;
  if (n === 1 && p.tallow >= 3) { p.tallow -= 3; game.addOil(12); game.sfx('pickup'); game.toast('The merchant renders your tallow. +12 oil.', 'good'); }
  else if (n === 2 && p.tallow >= 6) { p.tallow -= 6; game.addKindling(1, 'merchant trade'); }
  else { game.sfx('ui_click'); game.toast('"Bring more tallow, friend."', 'info'); }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (game.mode === 'title') {
    if (hasRunSave()) {
      if (k === 'enter' || k === 'e') {
        const snap = loadRun();
        if (snap) { game.restoreRun(snap); game.toast('Continuing the last expedition.'); }
        else { startPlaying(); }
      } else if (k === 'n') {
        game.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
        game.resetRun();
        startPlaying();
      } else { startPlaying(); }
    } else { startPlaying(); }
    return;
  }
  if (game.mode === 'dead' && (k === 'enter')) { game.respawn(); saveMeta(game.meta); return; }
  if (game.mode === 'dawn' && (k === 'enter')) { game.mode = 'play'; return; }

  // save / load / reset menu — movement and action keys are ignored while it is open
  if (game.ui.menu) {
    if (k === 'escape') { game.ui.menu = false; game.ui.menuMsg = ''; game.sfx('ui_click'); return; }
    if (k === '1') {
      const ok = saveRun(game.snapshotRun());
      game.ui.menuMsg = ok ? 'Expedition saved.' : 'Save failed.';
      game.toast(ok ? 'Saved.' : 'Failed to save.', ok ? 'good' : 'bad');
      game.sfx('ui_click');
      return;
    }
    if (k === '2') {
      const snap = loadRun();
      if (snap) {
        game.restoreRun(snap);
        game.ui.menu = false;
        game.ui.menuConfirm = false;
        game.ui.menuMsg = '';
        game.toast('Loaded.');
      } else {
        game.ui.menuMsg = 'No saved expedition.';
        game.toast('No saved expedition.', 'bad');
      }
      game.sfx('ui_click');
      return;
    }
    if (k === '3') {
      if (game.ui.menuConfirm) {
        wipeMeta();
        wipeRun();
        game.meta = defaultMeta();
        game.resetRun();
        game.mode = 'title';
        game.ui.menu = false;
        game.ui.menuConfirm = false;
        game.ui.menuMsg = '';
        game.toast('All progress reset.');
      } else {
        game.ui.menuConfirm = true;
        game.ui.menuMsg = 'Reset everything? Press [3] again to confirm.';
      }
      game.sfx('ui_click');
      return;
    }
    return;
  }

  if (game.ui.altar) {
    if (k === 'escape') { game.ui.altar = false; game.sfx('ui_click'); return; }
    if (k === 'arrowright') { game.ui.altarPage = (game.ui.altarPage || 0) + 1; game.sfx('ui_click'); return; }
    if (k === 'arrowleft') { game.ui.altarPage = Math.max(0, (game.ui.altarPage || 0) - 1); game.sfx('ui_click'); return; }
    const n = parseInt(k, 10);
    if (n >= 1 && game.ui.altarList && game.ui.altarList[n - 1]) buyUpgrade(game.ui.altarList[n - 1]);
    return;
  }
  if (game.ui.merchant) {
    if (k === 'escape') { game.ui.merchant = false; return; }
    if (k === '1' || k === '2') merchantTrade(parseInt(k, 10));
    return;
  }

  if (k === 'a' || k === 'arrowleft') input.left = true;
  if (k === 'd' || k === 'arrowright') input.right = true;
  if (k === 'w' || k === 'arrowup') input.up = true;
  if (k === 's' || k === 'arrowdown') input.down = true;
  if (k === 'e') game.interact();
  if (k === ' ') { e.preventDefault(); game.flash(); }
  if (k === 'b') game.placeBeacon();
  if (k === 'r') {
    const near = game.run.beacons.some(b => Math.hypot(b.x - game.player.x, b.y - game.player.y) < 1.8);
    const atHub = game.inHub() && Math.hypot(game.hubProps.cauldron.x - game.player.x, game.hubProps.cauldron.y - game.player.y) < 2.2;
    if (atHub) game.renderTallow(false);
    else if (near) game.renderTallow(true);
    else game.toast('Render only at the cauldron or a lit beacon.', 'bad');
  }
  if (k === 'q') game.cycleFocus();
  if (k === 'h') game.ui.help = !game.ui.help;
  if (k === 'p') game.ui.achievements = !game.ui.achievements;
  if (k === 'n') {
    SFX.setEnabled(!SFX.isEnabled());
    game.toast(SFX.isEnabled() ? 'Sound on.' : 'Sound off.', 'info');
  }
  if (k === 'm') game.ui.minimap = !game.ui.minimap;
  if (k === 'escape') {
    const anyOpen = game.ui.altar || game.ui.merchant || game.ui.help || game.ui.achievements;
    if (anyOpen) {
      game.ui.altar = false;
      game.ui.merchant = false;
      game.ui.help = false;
      game.ui.achievements = false;
      game.sfx('ui_click');
    } else {
      game.ui.menu = true;
      game.sfx('ui_open');
    }
    return;
  }
  // merchant opens if saved and near banner area
  if (k === 't' && game.meta.npcsSaved.includes('merchant') && game.inHub()) { game.ui.merchant = true; game.sfx('ui_open'); }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') input.left = false;
  if (k === 'd' || k === 'arrowright') input.right = false;
  if (k === 'w' || k === 'arrowup') input.up = false;
  if (k === 's' || k === 'arrowdown') input.down = false;
});

// flip player sprite by last horizontal direction
let lastMx = 1;
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'a') { lastMx = -1; game.player._flip = -1; }
  if (k === 'd') { lastMx = 1; game.player._flip = 1; }
});

// autosave periodically + on important events
setInterval(() => {
  if (game.mode !== 'title') saveMeta(game.meta);
  if (game.mode === 'play') saveRun(game.snapshotRun());
}, 15000);
window.addEventListener('pagehide', () => {
  if (game.mode !== 'title') saveMeta(game.meta);
  if (game.mode === 'play') saveRun(game.snapshotRun());
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.mode !== 'title') saveMeta(game.meta);
    if (game.mode === 'play') saveRun(game.snapshotRun());
  }
});

let last = performance.now();
let frameErrors = 0;
function loop(now) {
  try {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.time += game.mode === 'title' ? dt : 0;
    if (isTouch) applyTouchInput();
    // movement/action keys ignored while the save/load/reset menu is open
    if (game.ui.menu) { input.left = input.right = input.up = input.down = false; }
    game.update(dt, input);
    renderer.frame(dt);
    if (isTouch && game.mode === 'play') renderer.drawTouchControls(touch, buttonPositions());
  } catch (err) {
    // never let one bad frame kill the game
    if (++frameErrors <= 3) console.error('frame error', err);
    game.frameErrors = frameErrors;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
