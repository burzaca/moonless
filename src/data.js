// MOONLESS — static game data (mobs, upgrades, NPCs, relics, text).
// Pure data, no DOM, no randomness. See docs/INTERFACES.md section 4.
//
// Balance reference:
//   player speed 4.2 tiles/s, starting lantern oil 60 @ 1.2/s (~50s of pure burn,
//   ~3 min run once tallow pickups and rendering are factored in).
//   Starting burn dps assumed ~10 at the lantern edge; mobs are tuned so a mote
//   dies in ~1s, a stalker in ~4s, a wraith in ~13s (they resist light).
//   speed = tiles/sec. dmg = hp per hit, ~1 hit/sec when adjacent.

export const MOBS = {
  mote: {
    name: 'Mote', hp: 10, speed: 1.6, dmg: 3, burnWeak: 1.5,
    drops: { tallow: [1, 2] }, radius: 6, behavior: 'drift', tier: 0,
    flavor: 'A cinder that forgot it was ever fire. It drifts toward warmth, hungry and confused.',
  },
  stalker: {
    name: 'Stalker', hp: 40, speed: 3.6, dmg: 8, burnWeak: 1.0,
    drops: { tallow: [2, 4] }, radius: 9, behavior: 'hunt', tier: 1,
    flavor: 'Lean and patient. It walks where your light ends, and waits for it to flicker.',
  },
  wraith: {
    name: 'Wraith', hp: 80, speed: 2.8, dmg: 12, burnWeak: 0.6,
    drops: { tallow: [3, 6], oil: [1, 2] }, radius: 10, behavior: 'hunt', drainsOil: 2, tier: 2,
    flavor: 'Rags of someone who stayed out too long. It drinks the oil from your lantern like a memory.',
  },
  king_stag: {
    name: 'Stag of Cinders', hp: 350, speed: 3.0, dmg: 22, boss: true, kindling: 25,
    drops: { tallow: [10, 16] }, radius: 12, behavior: 'hunt', tier: 2, burnWeak: 1.5,
    flavor: 'Once it carried the dawn across the fields on its antlers. Now the antlers smoulder and the dawn is gone.',
  },
  king_choir: {
    name: 'The Drowned Choir', hp: 550, speed: 1.9, dmg: 18, boss: true, kindling: 35,
    drops: { tallow: [12, 20] }, radius: 14, behavior: 'drift', drainsOil: 3, tier: 2, burnWeak: 1.5,
    flavor: 'Samodivi who sang the moon to sleep each night. The salt took their voices. They still try.',
  },
  king_hollow: {
    name: 'Hollowking', hp: 900, speed: 2.6, dmg: 30, boss: true, kindling: 60,
    drops: { tallow: [20, 30] }, radius: 16, behavior: 'hunt', tier: 2, burnWeak: 1.5,
    flavor: 'A crown with nothing beneath it. It ate the moon, and it is still hungry.',
  },
};

// Meta tree bought with Kindling at the Hollow.
// Cost of level n (0-based) = round(cost * costGrowth^n).
export const UPGRADES = [
  {
    id: 'lantern_radius', name: 'Wider Glass', cost: 8, costGrowth: 1.5, maxLevel: 5,
    desc: 'Grind the lantern glass thinner. Light reaches one tile further per level.',
    effect: { lightRadius: 1 },
  },
  {
    id: 'lantern_burn', name: 'Hotter Wick', cost: 10, costGrowth: 1.5, maxLevel: 5,
    desc: 'Braid the wick with ember-thread. Your light burns Umbral things 20% harder per level.',
    effect: { burnDps: 0.35 },
  },
  {
    id: 'oil_tank', name: 'Deeper Reservoir', cost: 6, costGrowth: 1.45, maxLevel: 6,
    desc: 'A larger well beneath the flame. +20 maximum oil per level.',
    effect: { maxOil: 20 },
  },
  {
    id: 'flash_power', name: 'Bright Breath', cost: 12, costGrowth: 1.6, maxLevel: 4,
    desc: 'Your flash bursts wider and hits 25% harder per level.',
    effect: { flashRadius: 0.75, flashDmg: 0.25 },
  },
  {
    id: 'beacon_cap', name: 'More Braziers', cost: 15, costGrowth: 1.7, maxLevel: 5,
    desc: 'The Hollow forges another brazier. +1 beacon you may keep lit per level.',
    effect: { beaconCap: 1 },
  },
  {
    id: 'focus_red', name: 'Red Focus', cost: 20, costGrowth: 1, maxLevel: 1,
    desc: 'Unlock the red lens: a narrower light that burns far hotter.',
    effect: { unlockFocus: 1 },
  },
  {
    id: 'focus_gold', name: 'Gold Focus', cost: 25, costGrowth: 1, maxLevel: 1,
    desc: 'Unlock the gold lens: it shows what the dark has hidden.',
    effect: { unlockFocus: 1 },
  },
  {
    id: 'focus_blue', name: 'Blue Focus', cost: 30, costGrowth: 1, maxLevel: 1,
    desc: 'Unlock the blue lens: a cold light the Tide cannot easily drown. Slows Umbral things.',
    effect: { unlockFocus: 1 },
  },
  {
    id: 'cauldron_yield', name: 'Patient Cauldron', cost: 10, costGrowth: 1.55, maxLevel: 5,
    desc: 'Render tallow slower and kinder. +0.5 oil per tallow per level.',
    effect: { renderRatio: 0.5 },
  },
  {
    id: 'tide_resist', name: 'Bellmetal Charm', cost: 14, costGrowth: 1.6, maxLevel: 4,
    desc: 'The Tide drinks 12% less of your oil per level.',
    effect: { tideResist: 0.12 },
  },
  {
    id: 'start_gear', name: 'Packed Satchel', cost: 9, costGrowth: 1.6, maxLevel: 4,
    desc: 'Leave the Hollow with 4 tallow and 10 extra oil per level.',
    effect: { startTallow: 4, startOil: 10 },
  },
  {
    id: 'wick_mending', name: 'Wick Mending', cost: 12, costGrowth: 1.55, maxLevel: 5,
    desc: 'The lantern sips 8% less oil per level.',
    effect: { oilBurnMult: -0.08 },
  },
];

export const NPCS = [
  {
    id: 'merchant', name: 'Old Vasil', title: 'Wick Merchant', sprite: 'npc_merchant',
    findHint: 'A cart rattles somewhere in the fields. No horse pulls it.',
    taskHint: 'His cart lamp is dry. Bring him 5 tallow.',
    service: 'trade', passive: { tallowBonus: 0.1 },
    dialogueAwaken: [
      'Light? Real light? I had stopped believing in it.',
      'I sold wicks to every house from here to the sea. Then the houses went dark.',
      'Give an old man something to burn, and I will follow you home.',
    ],
    dialogueHub: [
      'Tallow for oil, oil for hope. Fair trade, always.',
      'My grandmother said a candle lit for the dead keeps the zmei from the roof.',
      'Business is slow. Business is also alive. I count that a good year.',
      'Bring me tallow. I will make it worth carrying.',
      'Every wick I sell is a little argument with the dark.',
    ],
  },
  {
    id: 'cartographer', name: 'Rada', title: 'The Cartographer', sprite: 'npc_cartographer',
    findHint: 'Paper scraps flutter among the pines, each with half a road drawn on it.',
    taskHint: 'She has lost her map case. Find it at a nearby shrine.',
    service: 'reveal', passive: { mobNotice: -0.05 },
    dialogueAwaken: [
      'Hold the light still. I need to see where I am.',
      'I mapped this valley twice. The dark keeps rubbing it out.',
      'Take me back to your fire. I will draw you the way.',
    ],
    dialogueHub: [
      'Every visit, I will ink a little more of the world back in.',
      'Maps are promises. This one says: there is still an edge to the dark.',
      'The ruins were a city once. I have its old name somewhere.',
      'Walk carefully near the salt. The pools are deeper than they look.',
      'You are the only thing on this map that moves toward the dark.',
    ],
  },
  {
    id: 'gravetender', name: 'Baba Stoyna', title: 'Grave-tender', sprite: 'npc_gravetender',
    findHint: 'Someone is digging in the ruins. The sound is slow and steady.',
    taskHint: 'She asks you to light the shrine where her husband rests.',
    service: 'heal', passive: { maxHp: 10 },
    dialogueAwaken: [
      'I was burying the last of them. Then there was no one left to bury me.',
      'Your lantern is warm. I had forgotten warm.',
      'Very well. The dead will keep. The living need tending.',
    ],
    dialogueHub: [
      'Sit. Let me bind that. The dark bites deep but heals clean.',
      'On Zadushnitsa we fed the dead bread and wine. Now I feed the living.',
      'Every grave I dug, I planted a seed. Some of them still try to grow.',
      'Do not grieve for what the dark took. Grieve for what it did not get to keep.',
      'Come back to me. That is all I ask.',
    ],
  },
  {
    id: 'child', name: 'Malina', title: 'Candle-child', sprite: 'npc_child',
    findHint: 'A tiny flame bobs in the tall grass, far too low for a grown hand.',
    taskHint: 'She is afraid to walk. Stand with her until a beacon is lit nearby.',
    service: 'follow', passive: { tallowBonus: 0.15 },
    dialogueAwaken: [
      'Is it morning? Mama said to wait until morning.',
      'My candle is very small. I kept it alive all by myself.',
      'Can I walk with you? I will be quiet. I am good at finding things.',
    ],
    dialogueHub: [
      'I found a shiny thing! It was under a stone that looked sad.',
      'Do you think the moon is just sleeping?',
      'The moths like my candle. I named them all.',
      'When I grow up I want a lantern as big as yours.',
      'You came back. You always come back.',
    ],
  },
  {
    id: 'bellwright', name: 'Kiril', title: 'Bellwright', sprite: 'npc_bellwright',
    findHint: 'A cracked bell rings once, very far off, from the salt flats.',
    taskHint: 'His bell clapper is lost. It lies near a spring.',
    service: 'tide', passive: { tideResist: 0.1 },
    dialogueAwaken: [
      'You heard it? Good. Then the bell still works.',
      'Bells drive off the dark. Everyone knows that. Everyone forgot.',
      'Take me home. I will hang a bell the Tide will fear.',
    ],
    dialogueHub: [
      'When the bell rings true, the Tide hesitates. Only a little. Enough.',
      'Kukeri wore bells to scare the winter off. I just make them louder.',
      'Bronze remembers every song you strike into it.',
      'Listen. Between the rings, you can hear the Hollow breathing.',
      'I will ring for you while you are out there. Count the bells and come home.',
    ],
  },
  {
    id: 'mothkeeper', name: 'Zhivka', title: 'Moth-keeper', sprite: 'npc_mothkeeper',
    findHint: 'A cloud of pale moths circles something deep in the whisper pines.',
    taskHint: 'Her moths are scattered. Carry her to a grove so they can gather.',
    service: 'veil', passive: { mobNotice: -0.15 },
    dialogueAwaken: [
      'Shh. The moths are listening for the light. So am I.',
      'They do not fear the dark. They only look past it.',
      'Let me come with you. My moths will hide your footsteps.',
    ],
    dialogueHub: [
      'The samodivi kept moths in their hair. I keep them in jars. Less glamorous.',
      'A moth will die for a flame. I try to teach them patience.',
      'The Umbral things smell warmth. My moths wear it for you, a little while.',
      'Every moth here was once a wish someone made on the moon.',
      'Walk softly. The dark has big ears and a short memory.',
    ],
  },
];

// Max 3 equipped, lost on death. Values are additive (fractions are multipliers).
export const RELICS = [
  { id: 'ember_heart', name: 'Ember Heart', desc: 'Still warm after all this time. +1 light radius.', effect: { lightRadius: 1 } },
  { id: 'zmei_scale', name: 'Zmei Scale', desc: 'Your light burns 25% hotter.', effect: { burnDps: 0.25 } },
  { id: 'samodiva_ribbon', name: 'Samodiva Ribbon', desc: 'Woven from mountain wind. +12% move speed.', effect: { moveSpeed: 0.12 } },
  { id: 'oil_seal', name: 'Wax Seal of Plenty', desc: 'A slow trickle of oil: +0.15 oil per second.', effect: { oilPerSec: 0.15 } },
  { id: 'iron_martenitsa', name: 'Iron Martenitsa', desc: 'Red and white, iron-hard. +25 max health.', effect: { maxHp: 25 } },
  { id: 'cracked_mirror', name: 'Cracked Mirror', desc: 'Throws your flash further. +2 flash radius.', effect: { flashRadius: 2 } },
  { id: 'tallow_spoon', name: 'Gravewax Spoon', desc: 'Umbral things give 30% more tallow.', effect: { tallowBonus: 0.3 } },
  { id: 'bell_shard', name: 'Bell Shard', desc: 'It hums when the Tide is near. Tide drains 25% less.', effect: { tideResist: 0.25 } },
  { id: 'moth_veil', name: 'Moth Veil', desc: 'Umbral things notice you 30% later.', effect: { mobNotice: -0.3 } },
  { id: 'khrosamir_seed', name: 'Khrosamir Seed', desc: 'A seed from the tree that grew the first sun. +25% Kindling.', effect: { kindlingBonus: 0.25 } },
];

export const LANDMARK_TEXT = {
  shrine: [
    'A roadside shrine. Someone left a candle here. You light it for them.',
    'The saint\'s face is worn smooth by hands. The niche still holds warmth.',
    'Prayers carved into the stone: for rain, for children, for the moon to come back.',
    'A shrine to Saint Elijah, who drove the zmei into the hills. The dark did not read the stories.',
  ],
  grove: [
    'Old oaks stand in a ring. The dark does not step inside.',
    'Ribbons hang from the branches, faded white. Every one is a wish.',
    'A samodivi grove. The grass grows in a circle where they once danced.',
    'The trees here lean toward your light like they remember it.',
  ],
  spring: [
    'A spring, still running. The water is cold and tastes faintly of stars.',
    'Coins glint at the bottom. Old wishes, still waiting.',
    'Healing water, the old songs said. Your hands stop shaking.',
    'A clay cup sits beside the spring, clean, as if someone expects you.',
  ],
  obelisk: [
    'A black stone older than the moon\'s death. Its runes glow faintly at your touch.',
    'The obelisk hums. It is counting something. You hope it is not you.',
    'Carved on its face: a moon, a hand, a lantern. Then nothing.',
  ],
  king_stag: 'Hoofprints burnt into the soil. Something with a crown of fire grazes the dark fields.',
  king_choir: 'Singing, over the salt. Many voices, all of them drowning.',
  king_hollow: 'The ruins slope down into a throne room with no roof and no king. Only a crown, waiting.',
};

export const TIPS = [
  'The dark eats oil faster the deeper you go. Turn back while the flame still burns.',
  'A lit beacon is a promise kept. It pays oil every second, even while you sleep.',
  'Tallow is heavy with what the dark took. Render it before you die, or it is lost.',
  'Stalkers wait where the light ends. Keep them inside it.',
  'Wraiths drink oil. Do not let them close. Flash, then walk away.',
  'When the bells ring and the edges go black, the Tide is coming. Stand by your beacons.',
  'Kindling remembers what you did. Spend it at the Hollow, and the next walk is kinder.',
  'Lost souls wander the wilds. Lend them light, and they will light the Hollow in return.',
  'Every shrine, grove and spring you find gives a spark of Kindling the first time.',
  'The Kings wait at the edges of the world. Do not go to them small.',
];

export const ACHIEVEMENTS = [
  { id: 'first_light', name: 'First Light', desc: 'Discover your first landmark', test: (g) => g.run.discovered.size >= 1 },
  { id: 'spark', name: 'Spark', desc: 'Earn your first Kindling', test: (g) => g.meta.totalKindling >= 1 },
  { id: 'beacon_1', name: 'A Pole in the Dark', desc: 'Plant your first Beacon', test: (g) => g.run.beaconsPlaced >= 1 },
  { id: 'tide_watcher', name: 'Tide-Watcher', desc: 'Survive a full Umbral Tide', test: (g) => g.run.tidesSurvived >= 1 || g.meta.tidesSurvived >= 1 },
  { id: 'soul_saved', name: 'Shepherd of Souls', desc: 'Guide a lost soul home', test: (g) => g.meta.npcsSaved.length >= 1 },
  { id: 'king_slayer', name: 'Kingbreaker', desc: 'Unmake an Umbral King', test: (g) => g.meta.kingsSlain.length >= 1 },
  { id: 'dawn', name: 'Dawnbringer', desc: 'Unmake all three Kings', test: (g) => g.meta.kingsSlain.length >= 3 },
  { id: 'deep_dark', name: 'Deep Dark', desc: 'Survive 30 seconds with no oil', test: (g) => (g.run.darkSurvival || 0) >= 30 },
  { id: 'trifocus', name: 'Trifocus', desc: 'Unlock all three lantern lenses', test: (g) => g.hasFocus('red') && g.hasFocus('gold') && g.hasFocus('blue') },
  { id: 'ember_hoarder', name: 'Ember Hoarder', desc: 'Earn 100 lifetime Kindling', test: (g) => g.meta.totalKindling >= 100 },
  { id: 'constellation', name: 'Constellation', desc: 'Hold 5 beacons at once', test: (g) => g.run.beacons.length >= 5 },
  { id: 'fifty_light', name: 'Fifty into Light', desc: 'Unmake 50 Umbral things', test: (g) => (g.meta.totalKills || 0) + g.run.kills >= 50 },
];
