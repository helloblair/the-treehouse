import { useEffect, useRef } from 'react'

interface RiverCrossingProps {
  landmarkName: string
  partyNames: string[]
  money: number
  depth: number
  onResult: (method: string, success: boolean, losses: { food: number; supplies: number; pioneers: string[] }) => void
}

const CANVAS_W = 400
const CANVAS_H = 150

export default function RiverCrossing({ landmarkName, partyNames, money, depth, onResult }: RiverCrossingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw river scene
    // Sky
    ctx.fillStyle = '#6BADE0'
    ctx.fillRect(0, 0, CANVAS_W, 40)

    // Far bank
    ctx.fillStyle = '#4A7A2E'
    ctx.fillRect(0, 40, CANVAS_W, 20)

    // Water
    const waterTop = 60
    const waterHeight = 60
    ctx.fillStyle = '#4A90D9'
    ctx.fillRect(0, waterTop, CANVAS_W, waterHeight)

    // Water waves
    ctx.fillStyle = '#3A80C9'
    for (let i = 0; i < 15; i++) {
      const wx = i * 30 + 5
      ctx.fillRect(wx, waterTop + 10 + (i % 3) * 15, 20, 2)
      ctx.fillRect(wx + 8, waterTop + 20 + (i % 2) * 10, 14, 2)
    }

    // Depth indicator
    const depthPx = (depth / 7) * waterHeight
    ctx.fillStyle = '#FF6B35'
    ctx.fillRect(CANVAS_W - 30, waterTop + waterHeight - depthPx, 4, depthPx)
    ctx.fillStyle = '#E8D5B7'
    ctx.font = '10px Courier New'
    ctx.fillText(`${depth.toFixed(1)} ft`, CANVAS_W - 50, waterTop + waterHeight - depthPx - 4)

    // Near bank
    ctx.fillStyle = '#8B7355'
    ctx.fillRect(0, waterTop + waterHeight, CANVAS_W, 30)

    // Wagon on near bank
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(30, waterTop + waterHeight - 5, 24, 12)
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(34, waterTop + waterHeight + 7, 4, 0, Math.PI * 2)
    ctx.arc(50, waterTop + waterHeight + 7, 4, 0, Math.PI * 2)
    ctx.fill()

    // Label
    ctx.fillStyle = '#E8D5B7'
    ctx.font = '12px Courier New'
    ctx.fillText(landmarkName, 10, CANVAS_H - 4)
  }, [depth, landmarkName])

  function ford() {
    // Risk based on depth: < 3ft safe, 3-5ft risky, > 5ft very risky
    const risk = depth < 3 ? 0.1 : depth < 5 ? 0.35 : 0.65
    const success = Math.random() > risk
    if (success) {
      onResult('ford', true, { food: 0, supplies: 0, pioneers: [] })
    } else {
      const foodLoss = Math.round(20 + Math.random() * 40)
      const drownRisk = depth > 5 ? 0.3 : 0.1
      const drowned = partyNames.filter(() => Math.random() < drownRisk)
      onResult('ford', false, { food: foodLoss, supplies: 0, pioneers: drowned })
    }
  }

  function caulk() {
    // Float: moderate risk regardless of depth
    const risk = depth < 3 ? 0.05 : depth < 5 ? 0.2 : 0.4
    const success = Math.random() > risk
    if (success) {
      onResult('caulk and float', true, { food: 0, supplies: 0, pioneers: [] })
    } else {
      const foodLoss = Math.round(30 + Math.random() * 50)
      const drownRisk = 0.15
      const drowned = partyNames.filter(() => Math.random() < drownRisk)
      onResult('caulk and float', false, { food: foodLoss, supplies: 1, pioneers: drowned })
    }
  }

  function ferry() {
    if (money < 5) return
    // Ferry is safe
    onResult('ferry', true, { food: 0, supplies: 0, pioneers: [] })
  }

  const depthLabel = depth < 3 ? '(shallow)' : depth < 5 ? '(moderate)' : '(deep & dangerous)'

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 8, fontSize: 14 }}>
        <strong>RIVER CROSSING</strong> - {landmarkName}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ border: '2px solid #8B6914', imageRendering: 'pixelated', maxWidth: '100%' }}
      />
      <div style={{ margin: '8px 0', fontSize: 13 }}>
        River depth: <strong>{depth.toFixed(1)} feet</strong> {depthLabel}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={ford}>
          Ford the river (free, risky)
        </button>
        <button onClick={caulk}>
          Caulk & float (free, moderate risk)
        </button>
        <button onClick={ferry} disabled={money < 5}>
          Take ferry ($5, safe){money < 5 ? ' - not enough money' : ''}
        </button>
      </div>
    </div>
  )
}
