// tools/dreadcheck.js — measure the Dread ramp: same bot, same seeds, different dread levels.
// Prints survival/deaths so the escalation is a measured curve, not a hope.
// Usage: node tools/dreadcheck.js [dreadLevels...]   (default 0 2 4 6 10)
import { simulate } from './simulate.js';
import { defaultMeta } from '../src/save.js';

const SEEDS = [1, 2, 3, 42, 99, 1234, 7777, 55555];
const LEVELS = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const levels = LEVELS.length ? LEVELS : [0, 2, 4, 6, 10];

console.log('dread  seeds  sim_s  deaths_avg  kills_avg  kindling_avg  t_first_death_avg');
for (const d of levels) {
  let survived = 0, deaths = 0, kills = 0, kindling = 0, firstDeath = 0, n = 0;
  for (const seed of SEEDS) {
    const meta = defaultMeta();
    meta.dread = d;
    try {
      const r = simulate(seed, 420, meta);
      survived += r.survived; kills += r.kills; kindling += r.kindling; deaths += r.deaths;
      firstDeath += r.firstDeath == null ? 420 : r.firstDeath;
      n++;
    } catch (e) {
      console.error(`dread ${d} seed ${seed} CRASH: ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(
    `${String(d).padEnd(7)} ${String(n).padEnd(6)} ${(survived / n).toFixed(0).padStart(5)}  ` +
    `${(deaths / n).toFixed(2).padStart(10)}  ${(kills / n).toFixed(1).padStart(10)}  ` +
    `${(kindling / n).toFixed(1).padStart(13)}  ${(firstDeath / n).toFixed(0).padStart(16)}s`
  );
}
