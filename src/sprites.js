// MOONLESS — hand-crafted palette-indexed pixel sprites. No assets, no DOM.
// Each sprite: { w, h, palette: { key: '#rrggbb' }, rows: string[] }, '.' = transparent.

// Mirror a left half into a symmetric row set (half width = w / 2).
function sym(halves) {
  return halves.map((r) => r + r.split('').reverse().join(''));
}

// Copy a row set, replacing rows by index.
function patch(rows, changes) {
  const out = rows.slice();
  for (const k of Object.keys(changes)) out[+k] = changes[k];
  return out;
}

// ---------------------------------------------------------------- palettes

const LANTERN = '#ffd27a';

const PLAYER_PAL = {
  o: '#0d0b10', // outline
  c: '#2b2833', // cloak shadow
  C: '#46404f', // cloak lit
  h: '#120f16', // hood interior
  e: '#c9b79a', // eye glint
  l: '#7a5a32', // lantern frame
  L: LANTERN,   // lantern flame
  y: '#fff1c4', // lantern core
};

// ---------------------------------------------------------------- player

const PLAYER_DOWN1 = [
  '......oooo......',
  '.....oCCCCo.....',
  '....oCccccCo....',
  '....oChhhhCo....',
  '....oheheheo....',
  '....oChhhhCo....',
  '...oCCcCCcCCo...',
  '..oCcccccccCo...',
  '.lCCcccccccCco..',
  'lllocccccccCco..',
  'lLLlcccccccCco..',
  'lyLlcccccccCco..',
  '.lloCccccccCco..',
  '...oCcccccccco..',
  '...occo...occo..',
  '...ooo.....ooo..',
];

const PLAYER_DOWN2 = patch(PLAYER_DOWN1, {
  8: '..oCcccccccCco..',
  9: '.lCocccccccCco..',
  10: 'lllocccccccCco..',
  11: 'lLLlcccccccCco..',
  12: 'lyLlCccccccCco..',
  13: '.lloCccccccccco.',
  14: '....occo..occo..',
  15: '....ooo...ooo...',
});

const PLAYER_UP1 = [
  '......oooo......',
  '.....oCCCCo.....',
  '....oCccccCo....',
  '....oCccccCo....',
  '....oCcCCcCo....',
  '....oCccccCo....',
  '...oCCcccccCo...',
  '..oCcccCcccCo...',
  '..oCcccCcccCCl..',
  '..oCcccCcccClll.',
  '..oCcccCcccClLLl',
  '..oCcccCcccClyLl',
  '..oCcccCcccColl.',
  '...oCcccccccco..',
  '...occo...occo..',
  '...ooo.....ooo..',
];

const PLAYER_UP2 = patch(PLAYER_UP1, {
  8: '..oCcccCcccCC...',
  9: '..oCcccCcccCCl..',
  10: '..oCcccCcccClll.',
  11: '..oCcccCcccClLLl',
  12: '..oCcccCcccClyLl',
  13: '...oCcccccccoll.',
  14: '....occo..occo..',
  15: '....ooo...ooo...',
});

const PLAYER_SIDE1 = [
  '......oooo......',
  '.....oCCCCo.....',
  '....oCcccCCo....',
  '....oCchhhCo....',
  '....oChhheho....',
  '....oChhhhho....',
  '...oCCccCCo.....',
  '..oCcccccCo.....',
  '..oCccccccCCl...',
  '..oCcccccco.lll.',
  '..oCcccccco.lLLl',
  '..oCcccccco.lyLl',
  '..oCccccccCo.ll.',
  '..oCcccccccco...',
  '...occo..occo...',
  '...ooo...ooo....',
];

const PLAYER_SIDE2 = patch(PLAYER_SIDE1, {
  8: '..oCccccccCC....',
  9: '..oCccccccoCl...',
  10: '..oCcccccco.lll.',
  11: '..oCcccccco.lLLl',
  12: '..oCccccccColyLl',
  13: '..oCcccccccco.l.',
  14: '....occccco.....',
  15: '....ooo.ooo.....',
});

// ---------------------------------------------------------------- mobs

const MOTE = {
  w: 12, h: 12,
  palette: { r: '#6e2a14', R: '#b5481e', y: '#e8893a', Y: LANTERN, w: '#fff1c4', o: '#1a0f0c' },
  rows: [
    '......r.....',
    '.....rR.....',
    '....rRy..r..',
    '...rRyyR.R..',
    '..rRyYYyRr..',
    '.rRyYwwYyRr.',
    '.rRyowwoyRr.',
    'rRyYwwwwYyRr',
    '.rRyYwwYyRr.',
    '..rRyYYyRr..',
    '...rRRRRr...',
    '.....rr.....',
  ],
};

const STALKER = {
  w: 16, h: 16,
  palette: { o: '#07060a', b: '#1c1a24', B: '#34303f', e: '#c4383e', w: '#bdb39a' },
  rows: [
    '................',
    '................',
    '...........o.o..',
    '..........obobo.',
    '.........obbbbo.',
    'o.......obbbebBo',
    '.o..oooobbbbbBwo',
    '..ooBbbbbbbbooo.',
    '..obBbbbbbbbo...',
    '..obbBBBBBbbo...',
    '..obo.....obo...',
    '..ob......ob....',
    '.ob.......ob....',
    '.ob........ob...',
    'ob.........ob...',
    'oo.........oo...',
  ],
};

const WRAITH = {
  w: 16, h: 16,
  palette: { o: '#0a0910', d: '#1d1b26', m: '#34313f', p: '#6a6478', e: '#9fd4d0' },
  rows: sym([
    '......oo',
    '.....odd',
    '....oddm',
    '....odmo',
    '...odmoo',
    '...odmoe',
    '...odmoo',
    '..oddmmo',
    '.pdddmmm',
    'pddmdmmd',
    '.pddmddm',
    '..pdmddm',
    '..pdd.dm',
    '...p..pd',
    '......p.',
    '.......p',
  ]),
};

const KING_STAG = {
  w: 24, h: 24,
  palette: {
    o: '#0b0809', b: '#1f1a1c', B: '#3a2f2c', c: '#7a3a1e',
    C: '#d0672a', y: '#ffb35a', e: '#ffe9a8',
  },
  rows: sym([
    'o.....o.....',
    'o..o..o...y.',
    'oo.o.oo.....',
    '.ooo.o..o...',
    '..ooooo.o...',
    '....oooo....',
    '......oooooo',
    '.......obbbb',
    '......obBbbb',
    '......obeBbb',
    '.......obbBb',
    '........obbB',
    '..y.....obbc',
    '.....oooobbc',
    '...oobbbbbcC',
    '..obbBbbbcCy',
    '.obbBbbbbbcC',
    '.obBbbcbbbbc',
    '.obbbbCbbbbb',
    '.obbbbbbbbbb',
    '..obo...obo.',
    '..obo...obo.',
    '..obo...obo.',
    '..oo....oo..',
  ]),
};

const KING_CHOIR = {
  w: 24, h: 24,
  palette: {
    o: '#070a0d', d: '#16202a', m: '#263544', b: '#3d5a6c',
    p: '#6b8796', w: '#c9d6d8',
  },
  rows: sym([
    '..........oo',
    '.........odd',
    '........oddm',
    '........odww',
    '...oo...owow',
    '..oddo..owww',
    '.oddmdo.odwo',
    '.odwwdo.oddm',
    '.owoowo.odmm',
    '.owwwwoodmmm',
    '.odwowdodmmb',
    'odmmmmddmmbm',
    'odmmbmmdmmbm',
    'odmbmmdmmmbm',
    'odmbmmmdmbmm',
    'odmbmmmdmbmm',
    'odmmbmmdmmbm',
    'odmmbmdmmmbm',
    '.odmbmdmmbmm',
    '.odmmbdmmbmm',
    '..pdmpdmpdmp',
    '..p.p..p.p.p',
    '...p....p...',
    '.....p......',
  ]),
};

const KING_HOLLOW = {
  w: 24, h: 24,
  palette: {
    o: '#3b2e4a', // cold rim so the void reads against darkness
    v: '#0b0710', d: '#140e1a', m: '#2a1f33',
    g: '#8a7a52', G: '#c4ac6a', E: '#8f7bd1', e: '#e2d6ff',
  },
  rows: sym([
    '............',
    '....g...g..g',
    '....Gg.gGg.G',
    '....gGgGgGgG',
    '....gggggggg',
    '...ovvvvvvvv',
    '..ovvddddddd',
    '..ovdddddddd',
    '.ovddEEddddd',
    '.ovdEeeEdddd',
    '.ovdEeeEdddd',
    '.ovddEEddddd',
    '.ovddddddddd',
    '.ovdddddmddd',
    'ovvddmdddddm',
    'ovddddddmddd',
    'ovdmdddddddm',
    'ovddddmddddd',
    'ovdddddddmdd',
    '.ovddmdddddd',
    '.ovd.dddmd.d',
    '..o..ddd.d..',
    '.....d....d.',
    '......d.....',
  ]),
};

// ---------------------------------------------------------------- NPCs

const NPC_MERCHANT = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#3a2e2a', C: '#5a4636', s: '#8c7466',
    e: '#1a1214', w: '#4a3524', W: '#6b4e32', L: LANTERN,
  },
  rows: [
    '............w...',
    '..oooo.....www..',
    '.occcco....wLw..',
    '.oCccCo....wLw..',
    '.oseseo....www..',
    '.osssso.....w...',
    '..oCCo......w...',
    '.oCccCo.....w...',
    'oCccccCsooowWWWw',
    'oCccccCo..wWWWWw',
    'oCccccCo..wWLWWw',
    'oCccccCo..wwwwww',
    '.oCccCo...owo.wo',
    '.occcco..owWwowW',
    '.oo..oo...owo.wo',
    '................',
  ],
};

const NPC_CARTOGRAPHER = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#2c3330', C: '#47524c', s: '#8c7466',
    e: '#1a1214', t: '#6b4e32', T: '#a58252', p: '#cfc3a0',
  },
  rows: [
    '............oTo.',
    '...oooo....oTto.',
    '..occcco..oTto..',
    '..oCccCo.oTto...',
    '..oseseooTto....',
    '..osssoTtto.....',
    '...oCoTtoo......',
    '..oCcTtcCo......',
    '.oCcTtccCCo.....',
    '.oCTtcccCCop....',
    '.oCtcccccCopp...',
    '.oCccccccCspp...',
    '.oCcccccccCo....',
    '..oCcccccCCo....',
    '...occo.occo....',
    '...ooo..ooo.....',
  ],
};

const NPC_GRAVETENDER = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#2b2a2e', C: '#44424a', s: '#8c7466',
    e: '#1a1214', h: '#8f8a80', w: '#5a4430', m: '#7d7f85',
  },
  rows: [
    '...........www..',
    '....oooo....w...',
    '...ohhhho...w...',
    '..ohhccco...w...',
    '..ohseseo...w...',
    '..ohsssso...w...',
    '...oCCCo....w...',
    '..oCcccCoo.sw...',
    '.oCcccccCCsow...',
    '.oCcccccCo..w...',
    '.oCcccccCo..w...',
    '.oCcccccCo.omo..',
    '.oCcccccCo.mmm..',
    '..oCcccCo..mmm..',
    '..occ.occ...m...',
    '..ooo.ooo.......',
  ],
};

const NPC_CHILD = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#3a2a30', C: '#5a3e46', s: '#9a8070',
    e: '#1a1214', h: '#4a3a2e', w: '#d8cfb8', L: LANTERN,
  },
  rows: [
    '................',
    '................',
    '...........L....',
    '..........LwL...',
    '...........w....',
    '.....oooo..w....',
    '....ohhhho.w....',
    '....ohsesho.s...',
    '....ohsssho.s...',
    '.....oCCooss....',
    '....oCccCs......',
    '....oCcccCo.....',
    '...oCcccccCo....',
    '...oCcccccCo....',
    '....os..so......',
    '....oo..oo......',
  ],
};

const NPC_BELLWRIGHT = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#33302c', C: '#4f4a40', s: '#8c7466',
    e: '#1a1214', a: '#5c4a3a', b: '#8a7440', B: '#c2a35c',
  },
  rows: [
    '................',
    '....oooo........',
    '...occcco.......',
    '..occcccco......',
    '..ocseseco......',
    '..ocsssscoo.....',
    '..oCCssCCcCo.bo.',
    '.oCccaacccCsobBo',
    '.oCcaaaaccCcbBBb',
    '.oCcaaaacCo.bBBb',
    '.oCcaaaacCo.bbbb',
    '.oCcaaaacCo..o..',
    '.oCcaaaacCo.....',
    '..oCaaaaCo......',
    '..occo.occo.....',
    '..ooo..ooo......',
  ],
};

const NPC_MOTHKEEPER = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', c: '#2a2834', C: '#403c4e', s: '#8c7466',
    e: '#1a1214', w: '#5a4430', n: '#8a8aa0', m: '#d8d2b8',
  },
  rows: [
    '..m.......nnn...',
    '.........n...n.m',
    '.....m...n.m.n..',
    '...oooo...n.n...',
    '..occcco...nw...',
    '..oseseo...w..m.',
    '..osssso..w.....',
    '...oCCo..w......',
    '..oCccCosw......',
    '.oCccccCs.......',
    '.oCccccCo..m....',
    '.oCccccCo.......',
    '.oCccccCo.......',
    '..oCcccCo.......',
    '..occ.occ.......',
    '..ooo.ooo.......',
  ],
};

// ---------------------------------------------------------------- props

const BEACON_BASE = [
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  'oooooooo',
  'oIaacaac',
  'oiIIIIII',
  '.oiiiiii',
  '..oiiiii',
  '...ooooi',
  '......oi',
  '.....oii',
  '...oi.oi',
  '..oi..oi',
];

const BEACON = {
  w: 16, h: 16,
  palette: { o: '#0d0b10', i: '#2e2c30', I: '#4c4a50', a: '#5c5650', c: '#1a1416' },
  rows: sym(BEACON_BASE),
};

const BEACON_LIT = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', i: '#2e2c30', I: '#4c4a50', r: '#b5481e',
    y: '#e8893a', L: LANTERN, W: '#fff1c4',
  },
  rows: sym(patch(BEACON_BASE, {
    0: '........',
    1: '.......y',
    2: '......yy',
    3: '....y.yL',
    4: '....yyLL',
    5: '...ryLLW',
    7: 'oIyrLryL',
  })),
};

const CAULDRON = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', i: '#2a2a2e', I: '#46464c', l: '#a8832e',
    L: '#e8c870', f: '#d0672a', F: '#ffb35a', s: '#6a6670',
  },
  rows: sym([
    '......s.',
    '.....s..',
    '......s.',
    '.....s..',
    '........',
    '.ooooooo',
    'oIIIIIII',
    'oolLllLl',
    '.oiIIIII',
    'oiiiiIII',
    'oiiiiiII',
    '.oiiiiiI',
    '..oiiiii',
    '...ooooo',
    '..o.fFfF',
    '.oo.ffFF',
  ]),
};

const SHRINE = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', s: '#3e3c44', S: '#5c5a64', d: '#141218',
    m: '#3a4a34', g: '#b89a5a', L: LANTERN,
  },
  rows: sym([
    '.......o',
    '......oS',
    '.....oSS',
    '....oSSs',
    '...ooooo',
    '....oSso',
    '....oSod',
    '....oSdd',
    '....oSdd',
    '....oSdg',
    '....oSdL',
    '....oSso',
    '...omSss',
    '..oSSsss',
    '.omssmss',
    'oooooooo',
  ]),
};

const OBELISK = {
  w: 16, h: 16,
  palette: {
    o: '#0b0c10', s: '#2c2e36', S: '#464a56', r: '#4f8aa0', R: '#9fd8ea',
  },
  rows: sym([
    '.......o',
    '......oS',
    '......oS',
    '.....oSs',
    '.....oSs',
    '.....oSr',
    '.....oSR',
    '.....oSr',
    '.....oSs',
    '.....oSs',
    '.....oSr',
    '.....oSs',
    '....oSSs',
    '....oSss',
    '...ooooo',
    '..oSSsss',
  ]),
};

const SPRING = {
  w: 16, h: 16,
  palette: {
    o: '#0b0c10', s: '#3a3a40', S: '#5a5a62', w: '#1f3a4a',
    W: '#3a6a7e', h: '#9fd4d0',
  },
  rows: [
    '................',
    '................',
    '................',
    '.......h........',
    '......hWh.......',
    '.......h........',
    '....oSSsoSo.....',
    '..oSswwwwwsSo...',
    '.oSwwWWwwwwwSo..',
    '.osWwwhWwwWwso..',
    'oSwwWwwwwhwwwSo.',
    'osWwwwWWwwwWwso.',
    '.oswWwwwwwwwso..',
    '..oSswwwwWsSo...',
    '....oSsosSo.....',
    '................',
  ],
};

const GROVE_MARKER = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', t: '#4a3a2e', l: '#3c5a3a', L: '#6e8f5a',
    f: '#e8e0c8', s: '#3e3c44', S: '#5c5a64',
  },
  rows: [
    '.......f........',
    '.....lLlLl......',
    '....lLLfLLl.....',
    '...lLlLLLlLl....',
    '...lLLLlLfLl....',
    '....lLfLLLl.....',
    '.....llLtl......',
    '.......t........',
    '.......t........',
    '..f...ott....f..',
    '.oSo..ot.o...oSo',
    '.oso.ottto...oso',
    '.oso.........oso',
    '..o.oSo.oSo...o.',
    '....oso.oso.....',
    '.....o...o......',
  ],
};

const TREE_PINE = {
  w: 16, h: 16,
  palette: {
    o: '#0a0d0b', d: '#18241d', g: '#24382b', G: '#36503c', t: '#3a2c24',
  },
  rows: sym([
    '.......o',
    '......og',
    '......dG',
    '.....odg',
    '....odgG',
    '.....odg',
    '....odgG',
    '...oddgG',
    '....odgg',
    '...oddgG',
    '..odddgG',
    '.oddddgG',
    '...ooddg',
    '......ot',
    '......ot',
    '.....oot',
  ]),
};

const TREE_DEAD = {
  w: 16, h: 16,
  palette: { o: '#0d0b10', b: '#2e2824', B: '#4a3e36' },
  rows: [
    '..o.........o...',
    '..ob......o.ob..',
    '...ob..o..ob.b..',
    '.o..ob.ob.ob.o..',
    '.ob..obBob.b.o..',
    '..ob.oBbBob.o...',
    '...ooobBbobo....',
    '......obBbo.....',
    '......oBbo......',
    '......obBo......',
    '......oBbo......',
    '......obBo......',
    '.....obBbo......',
    '....obBbbBo.....',
    '...obo.ob.bo....',
    '..oo...oo..oo...',
  ],
};

const ROCK = {
  w: 16, h: 16,
  palette: {
    o: '#0b0a0e', r: '#34323a', R: '#4c4a54', h: '#6a6874', m: '#3a4a34',
  },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '......oooo......',
    '....ooRhhRoo....',
    '...oRhhRRRrro...',
    '..oRhRRRRrrrro..',
    '..oRRRRrrrrrro..',
    '.oRRRrrrRrrrrro.',
    '.oRRrrrrrrrrrro.',
    '.ommrrrrrrrrmmo.',
    '.ommmrrrrrmmmmo.',
    '..ooommmmmmooo..',
    '.....oooooo.....',
    '................',
  ],
};

const CHEST = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', w: '#4a3424', W: '#6b4e32', i: '#2e2c30',
    I: '#5a5860', g: '#c4ac6a',
  },
  rows: [
    '................',
    '................',
    '................',
    '....oooooooo....',
    '..ooWWWWWWWWoo..',
    '.oIWWWWWWWWWWIo.',
    '.oIwWWWWWWWWwIo.',
    '.oiwwwwwwwwwwio.',
    '.ooooooggoooooo.',
    '.oIWWWWggWWWWIo.',
    '.oIWWWWooWWWWIo.',
    '.oiwWWWWWWWWwio.',
    '.oiwwwwwwwwwwio.',
    '.oiwwwwwwwwwwio.',
    '.oooooooooooooo.',
    '................',
  ],
};

const BANNER = {
  w: 16, h: 16,
  palette: {
    o: '#0d0b10', p: '#5a4430', P: '#8a6a44', r: '#4e1a1e',
    R: '#7e2a2c', g: '#c4ac6a', L: LANTERN,
  },
  rows: [
    '....oPo.........',
    '...ooPoooooooo..',
    '...opPppppppppo.',
    '....oPRRRRRRRo..',
    '....oPRRRgRRRo..',
    '....oPRRggrRRo..',
    '....oPRRgLgRro..',
    '....oPRRggrRro..',
    '....oPRRRgRrro..',
    '....oPRRRRrrro..',
    '....oPRRrRrRro..',
    '....oPRr.Rr.Ro..',
    '....oPo..ro..r..',
    '....oPo.........',
    '....oPo.........',
    '...ooPoo........',
  ],
};

// ---------------------------------------------------------------- pickups

const TALLOW = {
  w: 10, h: 10,
  palette: { o: '#1a1612', s: '#7d7258', w: '#b8ac8c', W: '#ddd2b0' },
  rows: [
    '..........',
    '...oooo...',
    '..oWWWwo..',
    '.oWWwwWwo.',
    '.oWwwwwso.',
    '.owwwwwso.',
    '.owwwssso.',
    '..oswsso..',
    '...oooo...',
    '..........',
  ],
};

const OILFLASK = {
  w: 10, h: 10,
  palette: {
    o: '#0d0b10', c: '#6b4e32', g: '#4a5560', G: '#8a9aa8',
    l: '#c98a2a', L: LANTERN,
  },
  rows: [
    '....cc....',
    '...occo...',
    '....gg....',
    '...ogGo...',
    '..oglLgo..',
    '.ogLllLGo.',
    '.oglllLgo.',
    '.ogllllgo.',
    '..oggggo..',
    '...oooo...',
  ],
};

const KINDLING = {
  w: 10, h: 10,
  palette: { r: '#d0672a', y: '#ffb35a', Y: LANTERN, w: '#fff1c4' },
  rows: sym([
    '....y',
    '.r..y',
    '..r.Y',
    '...yY',
    'yyYYw',
    '...rY',
    '..r.Y',
    '.r..y',
    '....r',
    '.....',
  ]),
};

// ---------------------------------------------------------------- registry

const SPRITES = {
  player_down1: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_DOWN1 },
  player_down2: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_DOWN2 },
  player_up1: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_UP1 },
  player_up2: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_UP2 },
  player_side1: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_SIDE1 },
  player_side2: { w: 16, h: 16, palette: PLAYER_PAL, rows: PLAYER_SIDE2 },

  mote: MOTE,
  stalker: STALKER,
  wraith: WRAITH,
  king_stag: KING_STAG,
  king_choir: KING_CHOIR,
  king_hollow: KING_HOLLOW,

  npc_merchant: NPC_MERCHANT,
  npc_cartographer: NPC_CARTOGRAPHER,
  npc_gravetender: NPC_GRAVETENDER,
  npc_child: NPC_CHILD,
  npc_bellwright: NPC_BELLWRIGHT,
  npc_mothkeeper: NPC_MOTHKEEPER,

  beacon: BEACON,
  beacon_lit: BEACON_LIT,
  cauldron: CAULDRON,
  shrine: SHRINE,
  obelisk: OBELISK,
  spring: SPRING,
  grove_marker: GROVE_MARKER,
  tree_pine: TREE_PINE,
  tree_dead: TREE_DEAD,
  rock: ROCK,
  chest: CHEST,
  banner: BANNER,

  tallow: TALLOW,
  oilflask: OILFLASK,
  kindling: KINDLING,
};

/**
 * @param {string} name
 * @returns {{ w:number, h:number, palette:Object<string,string>, rows:string[] } | null}
 */
export function getSprite(name) {
  const s = Object.prototype.hasOwnProperty.call(SPRITES, name) ? SPRITES[name] : null;
  if (!s) return null;
  return { w: s.w, h: s.h, palette: { ...s.palette }, rows: s.rows.slice() };
}

export function listSprites() {
  return Object.keys(SPRITES);
}
