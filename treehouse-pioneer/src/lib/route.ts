export interface Landmark {
  name: string
  miles: number
  description: string
  isRiver: boolean
  isFort: boolean
}

export const LANDMARKS: Landmark[] = [
  { name: 'Frontier Town',   miles: 0,    description: 'Your journey begins.',               isRiver: false, isFort: false },
  { name: 'Muddy Crossing',  miles: 102,  description: 'A shallow river ford.',              isRiver: true,  isFort: false },
  { name: "Settler's Rest",  miles: 185,  description: 'A small trading post.',              isRiver: false, isFort: true  },
  { name: 'Chimney Mesa',    miles: 268,  description: 'A towering rock formation.',         isRiver: false, isFort: false },
  { name: 'Fort Courage',    miles: 394,  description: 'Military outpost. Trade here.',      isRiver: false, isFort: true  },
  { name: 'Twin Forks',      miles: 483,  description: 'The river splits here.',             isRiver: true,  isFort: false },
  { name: 'High Plains Fort', miles: 676, description: 'Last major supply stop.',            isRiver: false, isFort: true  },
  { name: 'Eagle Pass',      miles: 932,  description: 'Danger in the mountains.',           isRiver: false, isFort: false },
  { name: 'Three Rivers',    miles: 1025, description: 'Water crossing required.',           isRiver: true,  isFort: false },
  { name: "Trader's Hollow", miles: 1172, description: 'A welcome stop.',                    isRiver: false, isFort: true  },
  { name: 'Deadwood Gulch',  miles: 1295, description: 'Rough terrain ahead.',               isRiver: false, isFort: false },
  { name: 'Cascade Summit',  miles: 1490, description: 'The highest point.',                 isRiver: false, isFort: false },
  { name: "Valley's End",    miles: 2040, description: 'You made it.',                       isRiver: false, isFort: false },
]

export const TOTAL_MILES = 2040

export function getLandmarkAtMiles(miles: number): Landmark | null {
  return LANDMARKS.find((l) => l.miles === miles) ?? null
}

export function getNextLandmark(currentMiles: number): Landmark {
  for (const l of LANDMARKS) {
    if (l.miles > currentMiles) return l
  }
  return LANDMARKS[LANDMARKS.length - 1]
}

export function getCurrentLandmark(currentMiles: number): Landmark {
  let current = LANDMARKS[0]
  for (const l of LANDMARKS) {
    if (l.miles <= currentMiles) current = l
  }
  return current
}
