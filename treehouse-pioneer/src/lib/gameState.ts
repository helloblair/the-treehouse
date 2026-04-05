export interface PioneerGameState {
  day: number
  miles: number
  totalMiles: 2040
  pace: 'steady' | 'strenuous' | 'grueling'
  rations: 'filling' | 'meager' | 'bare bones'
  supplies: {
    food: number
    oxen: number
    clothing: number
    ammunition: number
    medicine: number
    money: number
  }
  party: Pioneer[]
  currentLandmark: string
  nextLandmark: string
  milesUntilNextLandmark: number
  weather: 'good' | 'fair' | 'poor' | 'very poor'
  month: number
  activeEvent: RandomEvent | null
  phase: 'travel' | 'landmark' | 'hunt' | 'river' | 'event' | 'gameover' | 'victory'
  riverDepth?: number
  causeOfDeath?: string
  log: string[]
}

export interface Pioneer {
  name: string
  health: 'good' | 'fair' | 'poor' | 'very poor'
  illness?: string
  alive: boolean
}

export interface RandomEvent {
  id: string
  description: string
  choices: { label: string; outcome: string }[]
  resolved: boolean
}

export function createInitialState(partyNames: string[], startingMoney: number): PioneerGameState {
  return {
    day: 1,
    miles: 0,
    totalMiles: 2040,
    pace: 'steady',
    rations: 'filling',
    supplies: {
      food: 400,
      oxen: 6,
      clothing: 5,
      ammunition: 20,
      medicine: 3,
      money: startingMoney,
    },
    party: partyNames.map((name) => ({
      name,
      health: 'good',
      alive: true,
    })),
    currentLandmark: 'Frontier Town',
    nextLandmark: 'Muddy Crossing',
    milesUntilNextLandmark: 102,
    weather: 'good',
    month: 4,
    activeEvent: null,
    phase: 'landmark',
    log: ['Your journey begins at Frontier Town.'],
  }
}
