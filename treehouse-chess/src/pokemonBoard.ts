import type { CSSProperties } from 'react'

// Pokeball color palette
const BLK = '#0d0d0d' // board background
const RED = '#dc2626' // pokeball top
const WHT = '#f0f0f0' // pokeball bottom
const BAND = '#2a2a2a' // center band
const BTN = '#ffffff' // center button

// Center 4x4 pokeball accent (c-f, ranks 3-6) with diagonal corner cuts
// for a rounded ball shape. Uses CSS gradients for split-color squares.
const ACCENT: Record<string, CSSProperties> = {
  // rank 6 — top of ball: diagonal outline on corners, top-edge outline on middle
  c6: { background: `linear-gradient(135deg, ${BLK} 35%, ${RED} 35%)` },
  d6: { backgroundColor: RED },
  e6: { backgroundColor: RED },
  f6: { background: `linear-gradient(225deg, ${BLK} 35%, ${RED} 35%)` },
  // rank 5 — red with divider at bottom + button quarter-circle
  c5: { background: `linear-gradient(to bottom, ${RED} 92%, ${BLK} 92%)` },
  d5: { background: `radial-gradient(circle at 100% 100%, ${BTN} 25%, ${BLK} 25%, ${BLK} 35%, transparent 35%), linear-gradient(to bottom, ${RED} 92%, ${BLK} 92%)` },
  e5: { background: `radial-gradient(circle at 0% 100%, ${BTN} 25%, ${BLK} 25%, ${BLK} 35%, transparent 35%), linear-gradient(to bottom, ${RED} 92%, ${BLK} 92%)` },
  f5: { background: `linear-gradient(to bottom, ${RED} 92%, ${BLK} 92%)` },
  // rank 4 — white with divider at top + button quarter-circle
  c4: { background: `linear-gradient(to bottom, ${BLK} 8%, ${WHT} 8%)` },
  d4: { background: `radial-gradient(circle at 100% 0%, ${BTN} 25%, ${BLK} 25%, ${BLK} 35%, transparent 35%), linear-gradient(to bottom, ${BLK} 8%, ${WHT} 8%)` },
  e4: { background: `radial-gradient(circle at 0% 0%, ${BTN} 25%, ${BLK} 25%, ${BLK} 35%, transparent 35%), linear-gradient(to bottom, ${BLK} 8%, ${WHT} 8%)` },
  f4: { background: `linear-gradient(to bottom, ${BLK} 8%, ${WHT} 8%)` },
  // rank 3 — bottom of ball (white, corners cut)
  c3: { background: `linear-gradient(45deg, ${BLK} 35%, ${WHT} 35%)` },
  d3: { backgroundColor: WHT },
  e3: { backgroundColor: WHT },
  f3: { background: `linear-gradient(315deg, ${BLK} 35%, ${WHT} 35%)` },
}

const COLS = 'abcdefgh'

export const pokeballSquareStyles: Record<string, CSSProperties> = {}
for (let rank = 1; rank <= 8; rank++) {
  for (const col of COLS) {
    const sq = `${col}${rank}`
    pokeballSquareStyles[sq] = ACCENT[sq] ?? { backgroundColor: BLK }
  }
}

export const pokeballBoardStyle: CSSProperties = {
  backgroundColor: '#000',
  borderRadius: 4,
}

export const pokeballSquareStyle: CSSProperties = {
  outline: '1px solid rgba(255, 255, 255, 0.12)',
  overflow: 'hidden',
}

// Transparent so squareStyles controls all colors
export const pokeballDarkSquareStyle: CSSProperties = {
  backgroundColor: 'transparent',
}

export const pokeballLightSquareStyle: CSSProperties = {
  backgroundColor: 'transparent',
}
