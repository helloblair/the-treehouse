import type { CSSProperties, JSX } from 'react'

const SPRITE_BASE =
  'https://raw.githubusercontent.com/msikma/pokesprite/master/pokemon-gen8/regular'

// Scale per piece — tuned so visible pixel art fills ~75-85% of the square.
// Sprites are 68x56 with Pokemon grounded at bottom; we anchor to bottom and let
// the empty top padding overflow/clip.
const PIECE_POKEMON: Record<string, { slug: string; scale: number }> = {
  // White — "Light Kingdom"
  wK: { slug: 'arceus', scale: 1.3 },
  wQ: { slug: 'gardevoir', scale: 1.4 },
  wB: { slug: 'espeon', scale: 1.5 },
  wN: { slug: 'gallade', scale: 1.4 },
  wR: { slug: 'metagross', scale: 1.3 },
  wP: { slug: 'eevee', scale: 1.8 },
  // Black — "Shadow Reign"
  bK: { slug: 'giratina', scale: 1.2 },
  bQ: { slug: 'darkrai', scale: 1.3 },
  bB: { slug: 'gengar', scale: 1.3 },
  bN: { slug: 'zoroark', scale: 1.3 },
  bR: { slug: 'tyranitar', scale: 1.2 },
  bP: { slug: 'pawniard', scale: 1.8 },
}

type PieceRenderProps = { fill?: string; square?: string; svgStyle?: CSSProperties }

export type PromotionOverride = { slug: string; scale: number }

const PIECE_UNICODE: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
}

function renderSprite(slug: string, scale: number, alt: string) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <img
        src={`${SPRITE_BASE}/${slug}.png`}
        alt={alt}
        style={{
          width: '100%',
          imageRendering: 'pixelated',
          transform: `scale(${scale})`,
          transformOrigin: 'bottom center',
        }}
        draggable={false}
        onError={(e) => {
          // Replace broken sprite with unicode chess piece
          const target = e.currentTarget
          const parent = target.parentElement
          if (parent) {
            parent.innerHTML = ''
            const fallback = document.createElement('span')
            fallback.textContent = PIECE_UNICODE[alt] ?? '\u265F'
            fallback.style.cssText = 'font-size: 36px; line-height: 1; user-select: none;'
            parent.appendChild(fallback)
          }
        }}
      />
    </div>
  )
}

/**
 * Build the customPieces map. When `promotedSquares` is provided,
 * any piece on a promoted square renders its override sprite instead.
 */
export function buildPokemonPieces(
  promotedSquares?: Map<string, PromotionOverride>,
): Record<string, (props?: PieceRenderProps) => JSX.Element> {
  return Object.fromEntries(
    Object.entries(PIECE_POKEMON).map(([piece, { slug, scale }]) => [
      piece,
      (props?: PieceRenderProps) => {
        // Check if this specific square has a promotion override
        if (props?.square && promotedSquares?.has(props.square)) {
          const override = promotedSquares.get(props.square)!
          return renderSprite(override.slug, override.scale, piece)
        }
        return renderSprite(slug, scale, piece)
      },
    ]),
  )
}

// Default static pieces (no promotions) for backward compatibility
export const pokemonPieces = buildPokemonPieces()
