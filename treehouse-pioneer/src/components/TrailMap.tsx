import { useEffect, useRef } from 'react'
import { LANDMARKS, TOTAL_MILES } from '../lib/route'

interface TrailMapProps {
  miles: number
  day: number
  currentLandmark: string
}

const W = 400
const H = 300
const MARGIN_X = 30
const MARGIN_Y = 40
const TRAIL_W = W - MARGIN_X * 2
const TRAIL_H = H - MARGIN_Y * 2

// Color palette
const COLORS = {
  background: '#8B7355',
  trail: '#C4A35A',
  water: '#4A90D9',
  mountain: '#6B6B6B',
  trees: '#2D5A1B',
  wagon: '#8B4513',
  wagonWheel: '#FFFFFF',
  fort: '#8B0000',
  text: '#E8D5B7',
  highlight: '#FFD700',
  terrainNoise: '#7A6345',
}

// Get x,y position along the trail for a given mile
function getTrailPos(mile: number): [number, number] {
  const t = mile / TOTAL_MILES
  const x = MARGIN_X + t * TRAIL_W

  // Winding trail: sine wave for y variation
  const baseY = MARGIN_Y + TRAIL_H * 0.45
  const waveY = Math.sin(t * Math.PI * 4) * 35
  const driftY = Math.sin(t * Math.PI * 1.5) * 20
  const y = baseY + waveY + driftY

  return [x, y]
}

export default function TrailMap({ miles, day, currentLandmark }: TrailMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetMilesRef = useRef(miles)
  const currentMilesRef = useRef(miles)
  const animFrameRef = useRef(0)

  targetMilesRef.current = miles

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function draw() {
      // Animate wagon position
      const diff = targetMilesRef.current - currentMilesRef.current
      if (Math.abs(diff) > 0.5) {
        currentMilesRef.current += diff * 0.08
      } else {
        currentMilesRef.current = targetMilesRef.current
      }

      // Background with terrain noise
      ctx.fillStyle = COLORS.background
      ctx.fillRect(0, 0, W, H)

      // Terrain noise dots
      const seed = 42
      for (let i = 0; i < 200; i++) {
        const nx = ((i * 137 + seed) % W)
        const ny = ((i * 89 + seed * 3) % (H - 50)) + 10
        ctx.fillStyle = i % 3 === 0 ? COLORS.terrainNoise : '#7F6B50'
        ctx.fillRect(nx, ny, 2, 2)
      }

      // Draw trail as dotted line
      ctx.fillStyle = COLORS.trail
      for (let m = 0; m <= TOTAL_MILES; m += 8) {
        const [tx, ty] = getTrailPos(m)
        ctx.fillRect(Math.round(tx), Math.round(ty), 3, 3)
      }

      // Draw landmarks
      for (const lm of LANDMARKS) {
        const [lx, ly] = getTrailPos(lm.miles)
        const x = Math.round(lx)
        const y = Math.round(ly)

        if (lm.isRiver) {
          // River: blue wavy lines
          ctx.fillStyle = COLORS.water
          ctx.fillRect(x - 4, y - 6, 8, 2)
          ctx.fillRect(x - 3, y - 3, 8, 2)
          ctx.fillRect(x - 4, y, 8, 2)
          ctx.fillRect(x - 3, y + 3, 8, 2)
        } else if (lm.isFort) {
          // Fort: small square with flag
          ctx.fillStyle = COLORS.fort
          ctx.fillRect(x - 4, y - 4, 8, 8)
          ctx.fillRect(x - 1, y - 10, 2, 6)
          ctx.fillStyle = '#FF4444'
          ctx.fillRect(x + 1, y - 10, 4, 3)
        } else if (lm.miles > 800 && lm.miles < 1600) {
          // Mountain: triangle peaks
          ctx.fillStyle = COLORS.mountain
          ctx.beginPath()
          ctx.moveTo(x - 5, y + 4)
          ctx.lineTo(x, y - 8)
          ctx.lineTo(x + 5, y + 4)
          ctx.fill()
          // Snow cap
          ctx.fillStyle = '#DDD'
          ctx.beginPath()
          ctx.moveTo(x - 2, y - 4)
          ctx.lineTo(x, y - 8)
          ctx.lineTo(x + 2, y - 4)
          ctx.fill()
        } else if (lm.miles === 0 || lm.miles === TOTAL_MILES) {
          // Start / End: larger marker
          ctx.fillStyle = COLORS.highlight
          ctx.fillRect(x - 4, y - 4, 8, 8)
          ctx.fillStyle = '#000'
          ctx.fillRect(x - 2, y - 2, 4, 4)
        } else {
          // Trees: green pixels
          ctx.fillStyle = COLORS.trees
          ctx.fillRect(x - 2, y - 6, 4, 4)
          ctx.fillRect(x - 4, y - 3, 8, 3)
          ctx.fillStyle = '#5C3D1E'
          ctx.fillRect(x, y, 2, 4)
        }

        // Highlight current landmark
        if (lm.name === currentLandmark) {
          ctx.fillStyle = COLORS.highlight
          ctx.fillRect(x - 2, y + 8, 4, 4)
        }
      }

      // Draw wagon
      const [wx, wy] = getTrailPos(currentMilesRef.current)
      const wagonX = Math.round(wx)
      const wagonY = Math.round(wy)

      // Wagon body
      ctx.fillStyle = COLORS.wagon
      ctx.fillRect(wagonX - 6, wagonY - 10, 12, 7)

      // Canvas cover (white arc)
      ctx.fillStyle = '#D4C5A0'
      ctx.fillRect(wagonX - 5, wagonY - 14, 10, 5)
      ctx.fillRect(wagonX - 4, wagonY - 15, 8, 2)

      // Wheels
      ctx.fillStyle = COLORS.wagonWheel
      ctx.beginPath()
      ctx.arc(wagonX - 4, wagonY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(wagonX + 4, wagonY, 3, 0, Math.PI * 2)
      ctx.fill()

      // Wheel hubs
      ctx.fillStyle = COLORS.wagon
      ctx.fillRect(wagonX - 5, wagonY - 1, 2, 2)
      ctx.fillRect(wagonX + 3, wagonY - 1, 2, 2)

      // Progress text
      ctx.fillStyle = COLORS.text
      ctx.font = '12px Courier New'
      ctx.fillText(`Day ${day} — ${Math.round(currentMilesRef.current)} mi of ${TOTAL_MILES}`, 10, H - 10)

      // Current landmark on right
      ctx.textAlign = 'right'
      ctx.fillText(currentLandmark, W - 10, H - 10)
      ctx.textAlign = 'left'

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [currentLandmark, day])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ border: '2px solid #8B6914', imageRendering: 'pixelated', maxWidth: '100%', display: 'block' }}
    />
  )
}
