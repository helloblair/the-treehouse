import type { Pet, Mood } from '../types'

/** Parse a timestamp safely — returns Date.now() for null/undefined/invalid values. */
function safeTimestamp(isoStr: string | null | undefined): number {
  if (!isoStr) return Date.now()
  const t = new Date(isoStr).getTime()
  return Number.isNaN(t) ? Date.now() : t
}

export function calculateDecay(pet: Pet): Partial<Pet> {
  const now = Date.now()
  const hoursSinceFed = (now - safeTimestamp(pet.last_fed_at)) / 3600000
  const hoursSincePlayed = (now - safeTimestamp(pet.last_played_at)) / 3600000

  const hunger = Math.max(0, 100 - Math.floor(hoursSinceFed))
  const happiness = Math.max(0, 100 - Math.floor(hoursSincePlayed / 2))

  let health = pet.health ?? 100
  if (hunger === 0 && hoursSinceFed > 4) {
    health = Math.max(0, health - Math.floor((hoursSinceFed - 4) * 2))
  }

  return { hunger, happiness, health }
}

export function getMood(pet: Pet & { hunger: number; happiness: number; health: number }): Mood {
  const hour = new Date().getHours()
  if (hour >= 21 || hour < 7) return 'sleeping'
  if (pet.health < 30) return 'sick'

  const hoursSinceBath = (Date.now() - safeTimestamp(pet.last_bathed_at)) / 3600000
  if (hoursSinceBath > 8) return 'stinky'

  if (pet.hunger < 30) return 'hungry'
  if (pet.hunger > 80 && pet.happiness > 80 && pet.health > 80) return 'ecstatic'
  if (pet.happiness > 70) return 'happy'
  return 'excited'
}
