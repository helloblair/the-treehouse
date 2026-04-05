import type { PioneerGameState, RandomEvent } from './gameState'

type EventGenerator = (state: PioneerGameState) => RandomEvent | null

function pickAlive(state: PioneerGameState): string | null {
  const alive = state.party.filter((p) => p.alive)
  if (alive.length === 0) return null
  return alive[Math.floor(Math.random() * alive.length)].name
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// --- ILLNESS EVENTS ---

const illnessEvents: EventGenerator[] = [
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'dysentery',
      description: `${name} has dysentery.`,
      choices: [
        { label: 'Use medicine', outcome: 'medicine' },
        { label: 'Rest and hope', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'typhoid',
      description: `${name} has come down with typhoid fever.`,
      choices: [
        { label: 'Use medicine', outcome: 'medicine' },
        { label: 'Rest and hope', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'cholera',
      description: `${name} has cholera. This is very serious.`,
      choices: [
        { label: 'Use medicine', outcome: 'medicine' },
        { label: 'Rest and hope', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'snakebite',
      description: `${name} was bitten by a rattlesnake!`,
      choices: [
        { label: 'Use medicine', outcome: 'medicine' },
        { label: 'Suck out the venom', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'broken_arm',
      description: `${name} has broken an arm.`,
      choices: [
        { label: 'Splint and rest', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
  (state) => {
    const name = pickAlive(state)
    if (!name) return null
    return {
      id: 'measles',
      description: `${name} has come down with measles.`,
      choices: [
        { label: 'Use medicine', outcome: 'medicine' },
        { label: 'Rest and hope', outcome: 'rest' },
      ],
      resolved: false,
    }
  },
]

// --- WEATHER EVENTS ---

const weatherEvents: EventGenerator[] = [
  () => ({
    id: 'heavy_rain',
    description: 'Heavy rains have flooded the trail. You lose 3 days.',
    choices: [],
    resolved: false,
  }),
  (state) => {
    if (state.miles < 800 || state.month < 10) return null
    return {
      id: 'blizzard',
      description: 'A blizzard strikes! The party is stranded for days.',
      choices: [],
      resolved: false,
    }
  },
  () => ({
    id: 'hailstorm',
    description: 'A violent hailstorm damages your supplies.',
    choices: [],
    resolved: false,
  }),
  () => ({
    id: 'drought',
    description: 'A drought plagues the trail. The oxen suffer greatly.',
    choices: [],
    resolved: false,
  }),
]

// --- SUPPLY EVENTS ---

const supplyEvents: EventGenerator[] = [
  () => ({
    id: 'wagon_wheel',
    description: 'A wagon wheel has broken! You must stop to repair it.',
    choices: [
      { label: 'Repair it (costs time)', outcome: 'repair' },
    ],
    resolved: false,
  }),
  (state) => {
    if (state.supplies.oxen <= 2) return null
    return {
      id: 'ox_dies',
      description: 'One of your oxen has died.',
      choices: [],
      resolved: false,
    }
  },
  (state) => {
    if (state.supplies.food < 40) return null
    return {
      id: 'food_spoils',
      description: 'Some of your food has spoiled.',
      choices: [],
      resolved: false,
    }
  },
  () => ({
    id: 'clothing_stolen',
    description: 'A thief in the night stole a set of clothing.',
    choices: [],
    resolved: false,
  }),
]

// --- POSITIVE EVENTS ---

const positiveEvents: EventGenerator[] = [
  () => ({
    id: 'samaritan',
    description: 'A good samaritan shares food with your party.',
    choices: [],
    resolved: false,
  }),
  () => ({
    id: 'abandoned_supplies',
    description: 'You find abandoned supplies on the trail!',
    choices: [],
    resolved: false,
  }),
  () => ({
    id: 'shallow_river',
    description: 'The river ahead is shallower than expected. Easy crossing!',
    choices: [],
    resolved: false,
  }),
  () => ({
    id: 'tail_wind',
    description: 'A strong tailwind speeds you along the trail.',
    choices: [],
    resolved: false,
  }),
]

const allGenerators: EventGenerator[] = [
  ...illnessEvents,
  ...illnessEvents, // illness weighted 2x
  ...weatherEvents,
  ...supplyEvents,
  ...positiveEvents,
]

export function rollForEvent(state: PioneerGameState): RandomEvent | null {
  // ~25% chance per day
  if (Math.random() > 0.25) return null
  const shuffled = allGenerators.sort(() => Math.random() - 0.5)
  for (const gen of shuffled) {
    const event = gen(state)
    if (event) return event
  }
  return null
}

function findMemberByEvent(state: PioneerGameState, event: RandomEvent): number {
  const nameMatch = event.description.match(/^(\w+[\w\s]*)(?= has| was)/)
  if (!nameMatch) return -1
  const name = nameMatch[1].trim()
  return state.party.findIndex((p) => p.name === name && p.alive)
}

function degradeHealth(current: string): 'good' | 'fair' | 'poor' | 'very poor' {
  const order: Array<'good' | 'fair' | 'poor' | 'very poor'> = ['good', 'fair', 'poor', 'very poor']
  const idx = order.indexOf(current as 'good' | 'fair' | 'poor' | 'very poor')
  return order[Math.min(idx + 1, 3)]
}

export function applyEvent(state: PioneerGameState, choiceIndex?: number): string {
  const event = state.activeEvent
  if (!event) return ''
  const choice = event.choices[choiceIndex ?? 0]

  switch (event.id) {
    case 'dysentery':
    case 'typhoid':
    case 'cholera':
    case 'snakebite':
    case 'measles': {
      const idx = findMemberByEvent(state, event)
      if (idx === -1) break
      const severe = event.id === 'cholera' || event.id === 'typhoid'
      if (choice?.outcome === 'medicine' && state.supplies.medicine > 0) {
        state.supplies.medicine--
        state.party[idx].health = degradeHealth(state.party[idx].health)
        state.party[idx].illness = event.id
        return `${state.party[idx].name} was treated with medicine. Health declining but stable.`
      } else {
        // No medicine or chose to rest
        state.party[idx].health = degradeHealth(degradeHealth(state.party[idx].health))
        state.party[idx].illness = event.id
        if (severe && state.party[idx].health === 'very poor') {
          state.party[idx].alive = false
          state.party[idx].health = 'very poor'
          return `${state.party[idx].name} has died of ${event.id}.`
        }
        return `${state.party[idx].name} is suffering from ${event.id}.`
      }
    }
    case 'broken_arm': {
      const idx = findMemberByEvent(state, event)
      if (idx === -1) break
      state.party[idx].health = degradeHealth(state.party[idx].health)
      state.party[idx].illness = 'broken arm'
      state.day += 2
      return `${state.party[idx].name} has a broken arm. Lost 2 days resting.`
    }
    case 'heavy_rain':
      state.day += 3
      return 'Lost 3 days to heavy rains.'
    case 'blizzard':
      state.day += 5
      state.party.forEach((p) => {
        if (p.alive) p.health = degradeHealth(p.health)
      })
      return 'Blizzard! Lost 5 days. Everyone\'s health declined.'
    case 'hailstorm': {
      const foodLoss = rand(20, 50)
      state.supplies.food = Math.max(0, state.supplies.food - foodLoss)
      state.supplies.clothing = Math.max(0, state.supplies.clothing - 1)
      return `Hailstorm damaged supplies. Lost ${foodLoss} lbs of food and 1 set of clothing.`
    }
    case 'drought':
      state.party.forEach((p) => {
        if (p.alive) p.health = degradeHealth(p.health)
      })
      return 'Drought conditions. The oxen and party suffer.'
    case 'wagon_wheel':
      state.day += 3
      return 'Wagon wheel broken. Lost 3 days repairing.'
    case 'ox_dies':
      state.supplies.oxen = Math.max(0, state.supplies.oxen - 1)
      return `An ox has died. You now have ${state.supplies.oxen} oxen.`
    case 'food_spoils': {
      const loss = rand(30, 60)
      state.supplies.food = Math.max(0, state.supplies.food - loss)
      return `${loss} lbs of food has spoiled.`
    }
    case 'clothing_stolen':
      state.supplies.clothing = Math.max(0, state.supplies.clothing - 1)
      return 'A set of clothing was stolen in the night.'
    case 'samaritan':
      state.supplies.food += rand(30, 60)
      return 'A kind traveler shared food with your party.'
    case 'abandoned_supplies': {
      const extra = rand(20, 50)
      state.supplies.food += extra
      state.supplies.ammunition += rand(2, 5)
      return `Found abandoned supplies: ${extra} lbs of food and some ammunition.`
    }
    case 'shallow_river':
      return 'The river is shallow here. Easy crossing!'
    case 'tail_wind': {
      const bonus = rand(10, 25)
      state.miles += bonus
      return `Tailwind! Gained an extra ${bonus} miles.`
    }
  }

  state.activeEvent = null
  return 'The event passes without incident.'
}
