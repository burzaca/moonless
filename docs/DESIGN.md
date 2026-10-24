# MOONLESS — carry the last light

A dark-sandbox **incremental roguelike** in vanilla JS (zero dependencies, canvas 2D).
Built autonomously by Anakin (Hermes agent) in a 9-hour night build, 2026-10-24/25.

## Premise

The moon died. The **Umbral** — a living darkness — is swallowing the world.
You are the last **Lanternbearer**. Your lantern is your sight, your weapon, and your territory.
Light what was lost. Push the dark back. Or be the last thing it takes.

## Design pillars

1. **Light is everything.** Light radius = vision + weapon + claimed land. Oil is fuel AND economy.
2. **Incremental.** Beacons generate Oil/sec. Lantern tiers compound. Death converts progress into Kindling (permanent meta upgrades). Numbers go up, the dark goes back.
3. **Roguelike.** Procedurally generated wilds every run. Death = wake at the Hollow, lose carried Tallow, keep Kindling.
4. **Open-world sandbox.** One big free-roam map per run. No forced path. Landmarks, hidden NPCs, three Umbral Kings at the edges.
5. **Characters.** NPCs are lost souls wandering the dark — light them, help their task, and they walk home to the Hollow and give services + passive buffs. Mobs are Umbral things that hunt you and burn in your light.

## Core loop

1. Leave the Hollow (safe hub) into the Umbral wilds.
2. Light burns Umbral mobs inside your radius; they bite. They drop **Tallow**.
3. Render Tallow → **Oil** (cauldron at hub, portable render at camp). Oil feeds the lantern (burns per second, faster in the deep dark).
4. Plant **Beacons** (cost: tallow+oil): they light territory, generate Oil/sec, and push back the **Umbral Tide** — a darkness wave that periodically sweeps in from the map edges. Inside the tide: oil burns fast, mobs swarm.
5. Find **landmarks** (shrines, groves, springs, obelisks) → discover = Kindling + flavor.
6. Find **lost souls** (NPCs) → light + small task → they join the Hollow (services/passives).
7. Die → wake at the Hollow. Carried Tallow is lost. Kindling is kept. Spend Kindling on permanent upgrades.
8. Grow the lantern until you can face the three **Umbral Kings** at the deep corners.

## Systems

- **Lantern tiers** (Kindling): radius, burn-dps, oil tank, flash power.
- **Focus modes** (Kindling unlocks): White (balanced) · Red (burn dps+) · Gold (reveals hidden loot/paths) · Blue (tide resistance, slows mobs).
- **Flash** (Space): burst of light, costs oil, AoE damage + stagger. Your panic button.
- **Beacons**: incremental income + territory control + tide defense. Cap grows with upgrades.
- **Umbral Tide**: periodic wave from map edges; lit beacons carve safe pockets. Encourages planning, not turtling.
- **Relics**: rare drops, max 3 slots, lost on death (roguelike layer).
- **Kindling**: earned by first discoveries, NPC awakenings, king kills, deep-tier survival.

## NPCs (lost souls)

- **Wick Merchant** — trades tallow→oil/kindling.
- **The Cartographer** — reveals a map region per visit.
- **Grave-tender** — heals at hub, trades lore.
- **Candle-child** — follows you, finds hidden trinkets.
- **Bellwright** — lengthens the interval between tides.
- **Moth-keeper** — Umbral things notice you less.

## Mobs (Umbral things)

- **Mote** — drifting ember-thing, weak, burns easy. (tier 0)
- **Stalker** — hunts you in the dark, flees light. (tier 1)
- **Wraith** — ignores light partially, drains oil on touch. (tier 2)
- **Kings**: **Stag of Cinders** (fields), **The Drowned Choir** (salt), **Hollowking** (ruins). Big Kindling + relic.

## Visual identity

Procedural pixel art (palette-indexed sprites defined in code, no assets). Dark desaturated palette, warm lantern glow, radial-gradient light mask, fog of war (unexplored = black, explored-unlit = dim), particles (embers, moths), animated water and grass shimmer.

## Tech

- Vanilla JS ES modules, canvas 2D, zero dependencies.
- `node --test` for logic tests; `tools/simulate.js` headless balance sim.
- GitHub Pages deploy via workflow.
- Save/load via localStorage.

## Scope tiers

- **MUST**: worldgen, movement, light/fog, 3 mob types, combat, oil economy, beacons + oil/sec, hub, 2+ NPCs with services, death/run loop, Kindling meta upgrades, save, procedural sprites, HUD.
- **SHOULD**: tide, 6 NPCs, 3 kings, relics, focus modes, audio, particles.
- **NICE**: touch controls, achievements, daily seed, balance sim tuning.
