import type { Pet, Mood } from '../types'

export function calculateDecay(pet: Pet): Partial<Pet> {
  const now = Date.now()
  const hoursSinceFed = (now - new Date(pet.last_fed_at).getTime()) / 3600000
  const hoursSincePlayed = (now - new Date(pet.last_played_at).getTime()) / 3600000

  const hunger = Math.max(0, 100 - Math.floor(hoursSinceFed))
  const happiness = Math.max(0, 100 - Math.floor(hoursSincePlayed / 2))

  let health = pet.health
  if (hunger === 0 && hoursSinceFed > 4) {
    health = Math.max(0, pet.health - Math.floor((hoursSinceFed - 4) * 2))
  }

  return { hunger, happiness, health }
}

export function getMood(pet: Pet & { hunger: number; happiness: number; health: number }): Mood {
  const hour = new Date().getHours()
  if (hour >= 21 || hour < 7) return 'sleeping'
  if (pet.health < 30) return 'sick'

  const hoursSinceBath = (Date.now() - new Date(pet.last_bathed_at).getTime()) / 3600000
  if (hoursSinceBath > 8) return 'stinky'

  if (pet.hunger < 30) return 'hungry'
  if (pet.hunger > 80 && pet.happiness > 80 && pet.health > 80) return 'ecstatic'
  if (pet.happiness > 70) return 'happy'
  return 'excited'
}
