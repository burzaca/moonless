// MOONLESS — seeded RNG, value noise, tile enum. Deterministic everywhere.

export const T = {
  VOID: 0, GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, PINE: 5, DEADTREE: 6, ROCK: 7,
  RUIN_FLOOR: 8, RUIN_WALL: 9, HUB_FLOOR: 10, HUB_WALL: 11, ASH: 12, TALLGRASS: 13, BRIDGE: 14
};

export const BLOCKS_SIGHT = new Set([T.PINE, T.DEADTREE, T.RUIN_WALL, T.HUB_WALL, T.ROCK]);
export const BLOCKS_MOVE = new Set([T.VOID, T.WATER, T.PINE, T.DEADTREE, T.ROCK, T.RUIN_WALL, T.HUB_WALL]);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise (hash-based, smoothstep interpolation). Deterministic.
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13));
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 100000) / 100000;
}
function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise2D(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = smooth(fx - ix), ty = smooth(fy - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function fbm2D(x, y, scale, octaves, seed) {
  let v = 0, amp = 0.5, s = scale, total = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise2D(x, y, s, seed + i * 101);
    total += amp; amp *= 0.5; s /= 2;
  }
  return v / total;
}

export function makeRng(seed) {
  const f = mulberry32(seed);
  return {
    next: f,
    int: (min, max) => min + Math.floor(f() * (max - min + 1)),
    range: (a, b) => a + f() * (b - a),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    noise2D: (x, y, scale) => valueNoise2D(x, y, scale, seed),
    fbm: (x, y, scale, oct) => fbm2D(x, y, scale, oct, seed),
  };
}
