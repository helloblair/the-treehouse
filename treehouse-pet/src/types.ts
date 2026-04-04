export interface Pet {
  id: string
  user_id: string
  name: string
  pet_type: 'dachshund' | 'calico' | 'bunny' | 'frog' | 'hamster' | 'lizard'
  growth_stage: 'puppy' | 'junior' | 'adult'
  hunger: number
  happiness: number
  health: number
  xp: number
  last_fed_at: string
  last_played_at: string
  last_bathed_at: string
  last_active_at: string
  days_active: number
  created_at: string
}

export type Mood = 'happy' | 'hungry' | 'ecstatic' | 'sick' | 'sleeping' | 'excited' | 'stinky'
