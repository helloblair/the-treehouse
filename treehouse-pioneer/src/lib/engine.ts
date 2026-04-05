import type { PioneerGameState } from './gameState'
import { LANDMARKS, getNextLandmark, getCurrentLandmark, TOTAL_MILES } from './route'
import { rollForEvent, applyEvent } from './events'

function getDailyMiles(state: PioneerGameState): number {
  const base = state.pace === 'steady' ? 12 : state.pace === 'strenuous' ? 18 : 22
  const weatherMod = state.weather === 'good' ? 1.0 : state.weather === 'fair' ? 0.85 : state.weather === 'poor' ? 0.65 : 0.4
  const oxenMod = state.supplies.oxen >= 4 ? 1.0 : state.supplies.oxen >= 2 ? 0.7 : 0.4
  return Math.round(base * weatherMod * oxenMod)
}

function getDailyFoodConsumption(state: PioneerGameState): number {
  const aliveCount = state.party.filter((p) => p.alive).length
  const rationsMultiplier = state.rations === 'filling' ? 3 : state.rations === 'meager' ? 2 : 1
  return aliveCount * rationsMultiplier
}

function updateWeather(state: PioneerGameState): void {
  const roll = Math.random()
  if (state.month >= 10 || state.month <= 2) {
    // Winter — worse weather
    if (roll < 0.15) state.weather = 'good'
    else if (roll < 0.40) state.weather = 'fair'
    else if (roll < 0.75) state.weather = 'poor'
    else state.weather = 'very poor'
  } else if (state.month >= 6 && state.month <= 8) {
    // Summer — generally good
    if (roll < 0.50) state.weather = 'good'
    else if (roll < 0.80) state.weather = 'fair'
    else if (roll < 0.95) state.weather = 'poor'
    else state.weather = 'very poor'
  } else {
    // Spring/Fall
    if (roll < 0.35) state.weather = 'good'
    else if (roll < 0.65) state.weather = 'fair'
    else if (roll < 0.90) state.weather = 'poor'
    else state.weather = 'very poor'
  }
}

function applyHealthDecay(state: PioneerGameState): void {
  const healthOrder = ['good', 'fair', 'poor', 'very poor'] as const
  for (const p of state.party) {
    if (!p.alive) continue

    // Low rations damage health
    if (state.rations === 'bare bones' && Math.random() < 0.15) {
      const idx = healthOrder.indexOf(p.health)
      if (idx < 3) p.health = healthOrder[idx + 1]
    }

    // Grueling pace damages health
    if (state.pace === 'grueling' && Math.random() < 0.10) {
      const idx = healthOrder.indexOf(p.health)
      if (idx < 3) p.health = healthOrder[idx + 1]
    }

    // Very poor health + no food or medicine = death risk
    if (p.health === 'very poor' && state.supplies.food === 0) {
      if (Math.random() < 0.30) {
        p.alive = false
        state.log.push(`${p.name} has died of starvation.`)
      }
    }

    // Illness recovery (slow)
    if (p.illness && Math.random() < 0.08) {
      p.illness = undefined
      const idx = healthOrder.indexOf(p.health)
      if (idx > 0) p.health = healthOrder[idx - 1]
      state.log.push(`${p.name} has recovered from illness.`)
    }

    // Cold weather without clothing
    if (state.supplies.clothing < state.party.filter((m) => m.alive).length) {
      if ((state.weather === 'poor' || state.weather === 'very poor') && Math.random() < 0.10) {
        const idx = healthOrder.indexOf(p.health)
        if (idx < 3) p.health = healthOrder[idx + 1]
      }
    }
  }
}

function checkGameOver(state: PioneerGameState): boolean {
  const allDead = state.party.every((p) => !p.alive)
  if (allDead) {
    state.phase = 'gameover'
    state.causeOfDeath = 'The entire party has perished.'
    return true
  }
  if (state.supplies.oxen === 0) {
    state.phase = 'gameover'
    state.causeOfDeath = 'No oxen remain to pull the wagon.'
    return true
  }
  return false
}

export function advanceDays(state: PioneerGameState, days: number): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }

  // Cap log to prevent unbounded growth
  if (s.log.length > 200) s.log = s.log.slice(-150)

  for (let d = 0; d < days; d++) {
    if (s.phase === 'gameover' || s.phase === 'victory') break

    s.day++

    // Advance month roughly (30 days per month)
    s.month = 4 + Math.floor((s.day - 1) / 30)
    if (s.month > 12) s.month = ((s.month - 1) % 12) + 1

    // Consume food
    const foodNeeded = getDailyFoodConsumption(s)
    s.supplies.food = Math.max(0, s.supplies.food - foodNeeded)

    // Update weather
    updateWeather(s)

    // Travel miles
    const dailyMiles = getDailyMiles(s)
    s.miles = Math.min(s.miles + dailyMiles, TOTAL_MILES)

    // Health decay
    applyHealthDecay(s)

    // Check for landmark arrival
    const next = getNextLandmark(s.miles - dailyMiles)
    if (s.miles >= next.miles) {
      const current = getCurrentLandmark(s.miles)
      s.currentLandmark = current.name
      const nextNext = getNextLandmark(s.miles)
      s.nextLandmark = nextNext.name
      s.milesUntilNextLandmark = nextNext.miles - s.miles

      if (current.name === "Valley's End") {
        s.phase = 'victory'
        s.log.push("You have reached Valley's End!")
        break
      }

      // Check if landmark is a river
      const landmarkData = LANDMARKS.find((l) => l.name === current.name)
      if (landmarkData?.isRiver) {
        s.phase = 'river'
        s.riverDepth = Math.round((1.5 + Math.random() * 5.5) * 10) / 10  // 1.5 - 7.0 feet
        s.log.push(`Arrived at ${current.name}: A ${s.riverDepth < 3 ? 'shallow' : s.riverDepth < 5 ? 'moderate' : 'deep & dangerous'} river ford.`)
        break
      }

      if (landmarkData?.isFort) {
        s.phase = 'landmark'
        s.log.push(`Arrived at ${current.name}: ${current.description}`)
        break
      }

      s.log.push(`Passed ${current.name}.`)
    }

    // Update next landmark distance
    const nextL = getNextLandmark(s.miles)
    s.nextLandmark = nextL.name
    s.milesUntilNextLandmark = nextL.miles - s.miles

    // Check gameover before rolling events (health decay can kill everyone)
    if (checkGameOver(s)) break

    // Random event
    const event = rollForEvent(s)
    if (event) {
      s.activeEvent = event
      s.phase = 'event'
      s.log.push(event.description)
      break
    }
  }

  return s
}

export function resolveCurrentEvent(state: PioneerGameState, choiceIndex: number): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }

  const result = applyEvent(s, choiceIndex)
  s.log.push(result)
  s.activeEvent = null

  if (!checkGameOver(s)) {
    s.phase = 'travel'
  }

  return s
}

export function applyHuntResult(state: PioneerGameState, foodGained: number, ammoSpent: number): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }
  s.supplies.food += foodGained
  s.supplies.ammunition = Math.max(0, s.supplies.ammunition - ammoSpent)
  s.phase = 'travel'
  s.log.push(`Hunting complete: gained ${foodGained} lbs of food, used ${ammoSpent} bullets.`)
  return s
}

export function applyRiverResult(
  state: PioneerGameState,
  method: string,
  success: boolean,
  losses: { food: number; supplies: number; pioneers: string[] }
): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }

  if (success) {
    s.log.push(`Crossed the river by ${method} successfully.`)
  } else {
    s.supplies.food = Math.max(0, s.supplies.food - losses.food)
    for (const name of losses.pioneers) {
      const idx = s.party.findIndex((p) => p.name === name)
      if (idx >= 0) {
        s.party[idx].alive = false
        s.log.push(`${name} drowned while crossing the river.`)
      }
    }
    s.log.push(`River crossing by ${method} failed. Lost ${losses.food} lbs of food.`)
  }

  if (method === 'ferry') {
    s.supplies.money = Math.max(0, s.supplies.money - 5)
  }

  s.riverDepth = undefined
  s.phase = 'travel'
  if (s.party.every((p) => !p.alive)) {
    s.phase = 'gameover'
    s.causeOfDeath = 'The party drowned crossing a river.'
  }

  return s
}

export function simulateHunt(state: PioneerGameState): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }
  const maxAmmo = Math.min(10, s.supplies.ammunition)
  if (maxAmmo <= 0) {
    s.log.push('No ammunition available to hunt.')
    return s
  }
  const ammoUsed = Math.max(1, Math.floor(Math.random() * maxAmmo) + 1)
  let foodGained = 0
  for (let i = 0; i < ammoUsed; i++) {
    if (Math.random() < 0.55) {
      foodGained += Math.round(10 + Math.random() * 25)
    }
  }
  s.supplies.ammunition = Math.max(0, s.supplies.ammunition - ammoUsed)
  s.supplies.food += foodGained
  s.log.push(`Hunting complete: gained ${foodGained} lbs of food, used ${ammoUsed} bullets.`)
  return s
}

export function simulateRiverCrossing(
  state: PioneerGameState,
  method: 'ford' | 'caulk' | 'ferry',
): PioneerGameState {
  const depth = state.riverDepth ?? 3
  const aliveParty = state.party.filter((p) => p.alive).map((p) => p.name)

  let risk: number
  let success: boolean
  let losses = { food: 0, supplies: 0, pioneers: [] as string[] }

  switch (method) {
    case 'ford': {
      risk = depth < 3 ? 0.1 : depth < 5 ? 0.35 : 0.65
      success = Math.random() > risk
      if (!success) {
        losses.food = Math.round(20 + Math.random() * 40)
        const drownRisk = depth > 5 ? 0.3 : 0.1
        losses.pioneers = aliveParty.filter(() => Math.random() < drownRisk)
      }
      break
    }
    case 'caulk': {
      risk = depth < 3 ? 0.05 : depth < 5 ? 0.2 : 0.4
      success = Math.random() > risk
      if (!success) {
        losses.food = Math.round(30 + Math.random() * 50)
        losses.pioneers = aliveParty.filter(() => Math.random() < 0.15)
        losses.supplies = 1
      }
      break
    }
    case 'ferry': {
      if (state.supplies.money < 5) {
        const s = { ...state, log: [...state.log, 'Not enough money for the ferry ($5 required).'] }
        return s
      }
      success = true
      break
    }
  }

  const methodLabel = method === 'caulk' ? 'caulk and float' : method
  return applyRiverResult(state, methodLabel, success!, losses)
}

export function tradeAtFort(state: PioneerGameState, item: string, quantity: number): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, log: [...state.log] }

  if (quantity <= 0 || !Number.isFinite(quantity)) {
    s.log.push('Invalid trade quantity.')
    return s
  }

  const prices: Record<string, number> = {
    food: 0.5,
    clothing: 10,
    ammunition: 2,
    medicine: 15,
    oxen: 40,
  }

  const price = prices[item]
  if (!price) {
    s.log.push(`Unknown item: ${item}`)
    return s
  }

  const totalCost = price * quantity
  if (totalCost > s.supplies.money) {
    s.log.push(`Not enough money. Need $${totalCost}, have $${s.supplies.money}.`)
    return s
  }

  s.supplies.money -= totalCost
  const key = item as keyof typeof s.supplies
  if (typeof s.supplies[key] === 'number') {
    ;(s.supplies as Record<string, number>)[key] += quantity
  }
  s.log.push(`Bought ${quantity} ${item} for $${totalCost}.`)

  return s
}

export function restAtLandmark(state: PioneerGameState): PioneerGameState {
  const s = { ...state, supplies: { ...state.supplies }, party: state.party.map((p) => ({ ...p })), log: [...state.log] }
  s.day += 3
  const healthOrder = ['good', 'fair', 'poor', 'very poor'] as const
  for (const p of s.party) {
    if (p.alive && p.health !== 'good') {
      const idx = healthOrder.indexOf(p.health)
      if (idx > 0) p.health = healthOrder[idx - 1]
    }
  }
  // Consume food for rest days
  const aliveCount = s.party.filter((p) => p.alive).length
  const rationsMultiplier = s.rations === 'filling' ? 3 : s.rations === 'meager' ? 2 : 1
  s.supplies.food = Math.max(0, s.supplies.food - aliveCount * rationsMultiplier * 3)
  s.log.push('Rested for 3 days. The party feels better.')
  return s
}
