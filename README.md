# MOONLESS — carry the last light

**A dark-sandbox incremental roguelike.** The moon died. The Umbral — a living
darkness — is swallowing the world. You are the last Lanternbearer: your lantern
is your sight, your weapon, and your territory.

🎮 **Play now:** https://burzaca.github.io/moonless/ *(desktop browser, keyboard)*

Built in one 9-hour autonomous night by an AI agent (Anakin/Hermes), zero
dependencies — vanilla JS + canvas 2D, no build step, no assets. Every sprite is
palette-indexed pixel art defined in code.

## The loop

1. Leave **the Hollow** (your safe hub) into the procedurally generated wilds.
2. Your **light burns** Umbral things that touch it. They bite. They drop **tallow**.
3. **Render tallow into oil** at the hub cauldron or a lit beacon. Oil feeds the
   lantern — the deep dark burns it faster. At zero oil, the Umbral starts taking *you*.
4. **Plant beacons**: they light territory, generate oil per second (yes, the
   numbers go up), and carve safe pockets against the **Umbral Tide** — a darkness
   wave that periodically sweeps the map.
5. **Discover landmarks** (shrines, groves, springs, obelisks) and **awaken the six
   lost souls** wandering the dark — help their task and they walk home to the
   Hollow, giving services and passives.
6. Die and the dark takes your carried tallow — but **Kindling** (from discoveries,
   souls, and kills) is kept. Spend it at the **Ember Altar** on permanent lantern
   upgrades: wider glass, hotter wick, red/gold/blue focus lenses…
7. Three **Umbral Kings** wait at the edges of the world. Unmake all three and the
   Umbral breaks.

## Controls

| key | action |
|---|---|
| WASD / arrows | move |
| E | interact (landmarks, souls, cauldron, altar) |
| SPACE | **Flash** — burst of light, costs oil, burns nearby |
| B | plant a beacon (5 tallow + 10 oil) |
| R | render carried tallow into oil (at cauldron or lit beacon) |
| Q | cycle lantern focus (unlock lenses at the Altar) |
| M | map · H | help · ESC | close |

## The six lost souls

the **Wick Merchant** (trades) · the **Cartographer** (reveals the map) ·
the **Grave-tender** (heals) · the **Candle-child** (finds trinkets) ·
the **Bellwright** (slows the Tide) · the **Moth-keeper** (Umbral things notice you less).

## Development

```
npm test          # contract tests (node --test)
npm run sim       # headless bot plays 10 seeds — balance smoke test
```

- `docs/DESIGN.md` — the full design vision
- `docs/INTERFACES.md` — module contracts (worldgen/sprites/audio/data were
  delegated to Claude Opus 5.5 headless and validated by contract tests)
- `tools/simulate.js` — the bot that proves the game loop works without a browser

MIT licensed. A night-build by Anakin, October 2026.
