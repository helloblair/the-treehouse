// ── Pokemon Chess Piece Mappings ──
// Maps chess piece codes to Pokemon names, with per-square unique assignments
// for the starting position and type-based assignments for generic piece types.

export type PieceLore = {
  name: string
  title: string
  flavor: string
}

// Per-square starting position (unique Pokemon per square)
export const STARTING_SQUARE_POKEMON: Record<string, PieceLore> = {
  // White — "The Light Kingdom"
  a1: { name: 'Snorlax', title: 'Rook', flavor: 'blocks lanes by simply existing — an immovable wall' },
  b1: { name: 'Rapidash', title: 'Knight', flavor: 'a blazing horse that leaps unpredictably into battle' },
  c1: { name: 'Espeon', title: 'Bishop', flavor: 'a psychic striker who attacks from oblique angles' },
  d1: { name: 'Gardevoir', title: 'Queen', flavor: 'fiercely protective, tears open black holes to defend her king' },
  e1: { name: 'Arceus', title: 'King', flavor: 'the literal god of Pokemon — must be protected at all costs' },
  f1: { name: 'Alakazam', title: 'Bishop', flavor: 'a cerebral psychic who outmaneuvers, never brute-forces' },
  g1: { name: 'Gallade', title: 'Knight', flavor: 'a blade-armed warrior who leaps unpredictably' },
  h1: { name: 'Metagross', title: 'Rook', flavor: 'a steel fortress with legs — four brains, zero mercy' },
  a2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  b2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  c2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  d2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  e2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  f2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  g2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  h2: { name: 'Eevee', title: 'Pawn', flavor: 'small and unassuming but full of hidden potential' },
  // Black — "The Shadow Reign"
  a8: { name: 'Tyranitar', title: 'Rook', flavor: 'summons sandstorms — a siege engine clad in dark armor' },
  b8: { name: 'Absol', title: 'Knight', flavor: 'appears like a bad omen, strikes from nowhere' },
  c8: { name: 'Gengar', title: 'Bishop', flavor: 'slips through walls and attacks from the shadows — raw menace' },
  d8: { name: 'Darkrai', title: 'Queen', flavor: 'nightmares incarnate, terrifying reach — the piece you dread seeing mobilized' },
  e8: { name: 'Giratina', title: 'King', flavor: 'banished antimatter dragon, ruler of the Distortion World' },
  f8: { name: 'Mismagius', title: 'Bishop', flavor: 'a cunning ghost spell-caster who strikes from oblique angles' },
  g8: { name: 'Zoroark', title: 'Knight', flavor: 'master of illusions — the knight\'s trick of jumping over pieces' },
  h8: { name: 'Aggron', title: 'Rook', flavor: 'clad in steel armor — a castle wall with teeth' },
  a7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  b7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  c7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  d7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  e7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  f7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  g7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
  h7: { name: 'Pawniard', title: 'Pawn', flavor: '"Pawn" is literally in the name — evolves into Bisharp' },
}

// Generic piece-type mapping (used when we don't know the origin square)
export const PIECE_TYPE_POKEMON: Record<string, Record<string, string>> = {
  w: { k: 'Arceus', q: 'Gardevoir', r: 'Metagross', b: 'Espeon', n: 'Gallade', p: 'Eevee' },
  b: { k: 'Giratina', q: 'Darkrai', r: 'Tyranitar', b: 'Gengar', n: 'Zoroark', p: 'Pawniard' },
}

export const FACTION_NAMES: Record<string, string> = {
  w: 'The Light Kingdom',
  b: 'The Shadow Reign',
}

export const PROMOTION_LORE: Record<string, string> = {
  w: 'Eevee reaches the back rank and EVOLVES!',
  b: 'Pawniard reaches the back rank — the shadows twist and something new emerges!',
}

// Promotion Pokemon — what each pawn becomes when promoted
export const PROMOTION_POKEMON: Record<string, Record<string, { name: string; slug: string; scale: number }>> = {
  w: {
    q: { name: 'Vaporeon', slug: 'vaporeon', scale: 1.5 },
    r: { name: 'Flareon', slug: 'flareon', scale: 1.5 },
    n: { name: 'Jolteon', slug: 'jolteon', scale: 1.5 },
    b: { name: 'Espeon', slug: 'espeon', scale: 1.5 },
  },
  b: {
    q: { name: 'Hydreigon', slug: 'hydreigon', scale: 1.2 },
    r: { name: 'Houndoom', slug: 'houndoom', scale: 1.3 },
    n: { name: 'Weavile', slug: 'weavile', scale: 1.4 },
    b: { name: 'Mismagius', slug: 'mismagius', scale: 1.4 },
  },
}

export const CASTLING_LORE: Record<string, string> = {
  w: 'Arceus retreats behind the fortress walls — even gods need protection!',
  b: 'Giratina phases through the Distortion World, rearranging reality itself to find safety!',
}
