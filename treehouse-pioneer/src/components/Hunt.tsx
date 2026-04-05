import { useEffect, useRef, useState, useCallback } from 'react'

interface Animal {
  type: 'rabbit' | 'deer' | 'bison'
  x: number
  y: number
  speed: number
  width: number
  height: number
  alive: boolean
  color: string
  food: number
}

interface HuntProps {
  maxAmmo: number
  onComplete: (foodGained: number, ammoSpent: number) => void
}

const CANVAS_W = 400
const CANVAS_H = 200
const HUNT_DURATION = 30_000
const SPAWN_INTERVAL = 1500

function createAnimal(): Animal {
  const roll = Math.random()
  if (roll < 0.50) {
    return { type: 'rabbit', x: CANVAS_W, y: 120 + Math.random() * 60, speed: 3 + Math.random() * 2, width: 10, height: 8, alive: true, color: '#A0826D', food: 10 }
  } else if (roll < 0.85) {
    return { type: 'deer', x: CANVAS_W, y: 80 + Math.random() * 80, speed: 2 + Math.random() * 1.5, width: 20, height: 16, alive: true, color: '#8B6914', food: 50 }
  } else {
    return { type: 'bison', x: CANVAS_W, y: 60 + Math.random() * 80, speed: 1 + Math.random(), width: 30, height: 22, alive: true, color: '#5C3D1E', food: 100 }
  }
}

export default function Hunt({ maxAmmo, onComplete }: HuntProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animalsRef = useRef<Animal[]>([])
  const ammoRef = useRef(0)
  const foodRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(HUNT_DURATION / 1000)
  const [ammoUsed, setAmmoUsed] = useState(0)
  const [foodGained, setFoodGained] = useState(0)
  const doneRef = useRef(false)
  const animFrameRef = useRef(0)
  const startTimeRef = useRef(0)
  const lastSpawnRef = useRef(0)

  const finishHunt = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    cancelAnimationFrame(animFrameRef.current)
    onComplete(foodRef.current, ammoRef.current)
  }, [onComplete])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    startTimeRef.current = Date.now()
    lastSpawnRef.current = Date.now()

    function draw(now: number) {
      if (doneRef.current) return

      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, HUNT_DURATION - elapsed)
      setTimeLeft(Math.ceil(remaining / 1000))

      if (remaining <= 0) {
        finishHunt()
        return
      }

      // Spawn animals
      if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
        animalsRef.current.push(createAnimal())
        lastSpawnRef.current = now
      }

      // Update positions
      animalsRef.current = animalsRef.current.filter((a) => {
        if (!a.alive) return false
        a.x -= a.speed
        return a.x + a.width > 0
      })

      // Draw
      ctx.fillStyle = '#4A7A2E'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Sky
      ctx.fillStyle = '#6BADE0'
      ctx.fillRect(0, 0, CANVAS_W, 50)

      // Ground details
      ctx.fillStyle = '#3D6A1E'
      for (let i = 0; i < 20; i++) {
        const gx = (i * 23 + (now * 0.01)) % CANVAS_W
        ctx.fillRect(gx, 160 + (i % 3) * 10, 3, 8)
      }

      // Animals
      for (const a of animalsRef.current) {
        ctx.fillStyle = a.color
        ctx.fillRect(Math.round(a.x), Math.round(a.y), a.width, a.height)

        // Legs
        ctx.fillStyle = '#2B1B0E'
        if (a.type === 'bison') {
          ctx.fillRect(Math.round(a.x + 4), Math.round(a.y + a.height), 3, 6)
          ctx.fillRect(Math.round(a.x + a.width - 7), Math.round(a.y + a.height), 3, 6)
        } else if (a.type === 'deer') {
          ctx.fillRect(Math.round(a.x + 3), Math.round(a.y + a.height), 2, 5)
          ctx.fillRect(Math.round(a.x + a.width - 5), Math.round(a.y + a.height), 2, 5)
        } else {
          ctx.fillRect(Math.round(a.x + 2), Math.round(a.y + a.height), 1, 3)
          ctx.fillRect(Math.round(a.x + a.width - 3), Math.round(a.y + a.height), 1, 3)
        }

        // Eye
        ctx.fillStyle = '#000'
        ctx.fillRect(Math.round(a.x + 2), Math.round(a.y + 2), 2, 2)
      }

      // Crosshair hint text
      ctx.fillStyle = '#E8D5B7'
      ctx.font = '11px Courier New'
      ctx.fillText(`Ammo: ${maxAmmo - ammoRef.current}  Food: ${foodRef.current} lbs`, 8, 16)

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [maxAmmo, finishHunt])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (doneRef.current) return
    if (ammoRef.current >= maxAmmo) {
      finishHunt()
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    ammoRef.current++
    setAmmoUsed(ammoRef.current)

    // Check hit (check larger animals first for fair gameplay)
    const sorted = [...animalsRef.current].sort((a, b) => b.width - a.width)
    for (const a of sorted) {
      if (cx >= a.x && cx <= a.x + a.width && cy >= a.y && cy <= a.y + a.height + 6) {
        a.alive = false
        foodRef.current += a.food
        setFoodGained(foodRef.current)
        break
      }
    }

    if (ammoRef.current >= maxAmmo) {
      setTimeout(finishHunt, 500)
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 8, fontSize: 14 }}>
        <strong>HUNTING</strong> - Click to shoot! Time: {timeLeft}s | Ammo: {maxAmmo - ammoUsed} | Food: {foodGained} lbs
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        style={{ cursor: 'crosshair', border: '2px solid #8B6914', imageRendering: 'pixelated', maxWidth: '100%' }}
      />
    </div>
  )
}
