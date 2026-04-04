import type { CSSProperties } from 'react'

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

export const pokemonPieces: Record<string, (props?: PieceRenderProps) => JSX.Element> =
  Object.fromEntries(
    Object.entries(PIECE_POKEMON).map(([piece, { slug, scale }]) => [
      piece,
      () => (
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
            alt={piece}
            style={{
              width: '100%',
              imageRendering: 'pixelated',
              transform: `scale(${scale})`,
              transformOrigin: 'bottom center',
            }}
            draggable={false}
          />
        </div>
      ),
    ]),
  )
