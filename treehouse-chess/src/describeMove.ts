import {
  PIECE_TYPE_POKEMON,
  FACTION_NAMES,
  PROMOTION_LORE,
  CASTLING_LORE,
  PROMOTION_POKEMON,
} from './pokemonLore'

// chess.js Move shape (subset of fields we use)
export type ChessMove = {
  color: 'w' | 'b'
  piece: string   // p, n, b, r, q, k
  from: string    // e.g. "e2"
  to: string      // e.g. "e4"
  san: string     // e.g. "Nf3", "Bxc6+"
  captured?: string
  flags: string   // k=kingside castle, q=queenside castle, e=en passant, p=promotion
  promotion?: string
}

/**
 * Translate a chess.js move object into Pokemon narrative context.
 * Pure function — no side effects, no React dependency.
 */
export function describeMove(move: ChessMove): string {
  const color = move.color
  const faction = FACTION_NAMES[color]
  const pokemon = getPokemonName(move.piece, color)
  const parts: string[] = []

  // Castling
  if (move.flags.includes('k') || move.flags.includes('q')) {
    const side = move.flags.includes('k') ? 'kingside' : 'queenside'
    parts.push(`${faction} castles ${side} (${move.san}).`)
    parts.push(CASTLING_LORE[color])
    return parts.join(' ')
  }

  // Basic move description
  parts.push(`${faction}'s ${pokemon} moves from ${move.from} to ${move.to} (${move.san}).`)

  // Capture
  if (move.captured) {
    const victimColor = color === 'w' ? 'b' : 'w'
    const victim = getPokemonName(move.captured, victimColor as 'w' | 'b')
    parts.push(`${pokemon} captures ${victim}!`)

    // En passant
    if (move.flags.includes('e')) {
      parts.push('A sneaky en passant capture — struck from a phantom angle!')
    }
  }

  // Check
  if (move.san.includes('+')) {
    const targetKing = color === 'w' ? 'Giratina' : 'Arceus'
    parts.push(`${targetKing} is in CHECK!`)
  }

  // Checkmate
  if (move.san.includes('#')) {
    const targetKing = color === 'w' ? 'Giratina' : 'Arceus'
    parts.push(`CHECKMATE! ${targetKing} has fallen!`)
  }

  // Promotion
  if (move.promotion) {
    const promoInfo = PROMOTION_POKEMON[color]?.[move.promotion]
    parts.push(PROMOTION_LORE[color])
    if (promoInfo) {
      if (color === 'w') {
        parts.push(`Eevee evolved into ${promoInfo.name}!`)
      } else {
        parts.push(`Pawniard transforms into ${promoInfo.name}!`)
      }
    }
  }

  return parts.join(' ')
}

/**
 * Get the Pokemon name for a piece using the type-based mapping.
 */
function getPokemonName(piece: string, color: 'w' | 'b'): string {
  return PIECE_TYPE_POKEMON[color]?.[piece] ?? piece
}
