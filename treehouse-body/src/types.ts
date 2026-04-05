export interface BodyPart {
  id: string
  name: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  side: 'left' | 'right'
  labelY: number
  info: string
  quiz: string
  answer: string
  options: string[]
}

export interface BodySystemConfig {
  id: string
  name: string
  icon: string
  color: string
  accent: string
  darkAccent: string
  circleAccent: string
  description: string
  funFact: string
  imageSrc: string
  parts: BodyPart[]
}

export interface PlayerStats {
  totalClicks: number
  totalQuizzes: number
  totalCorrect: number
  currentStreak: number
  bestStreak: number
  exploredParts: Record<string, Set<string>>
  quizResults: Record<string, Record<string, boolean>>
  perfectSystems: Set<string>
  xp: number
}

export interface TreehouseToolCall {
  type: 'TREEHOUSE_TOOL_CALL'
  pluginId: string
  payload: {
    callId: string
    toolName: string
    params: Record<string, unknown>
  }
}

export interface TreehouseToolResult {
  type: 'TREEHOUSE_TOOL_RESULT'
  pluginId: string
  payload: {
    callId: string
    result: unknown
    isError: boolean
  }
}
