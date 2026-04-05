import type { PlayerStats } from '../types'
import { BODY_SYSTEMS } from '../data/systems'

export type StatsGetter = () => PlayerStats

let getStats: StatsGetter | null = null

export function registerBodyTools(statsGetter: StatsGetter) {
  getStats = statsGetter
}

export function handleToolCall(
  toolName: string,
  _params: Record<string, unknown>,
): unknown {
  switch (toolName) {
    case 'get_progress': {
      if (!getStats) return { error: 'Not initialized' }
      const s = getStats()
      const systemProgress: Record<
        string,
        { explored: number; total: number; quizCorrect: number }
      > = {}
      for (const [id, sys] of Object.entries(BODY_SYSTEMS)) {
        const explored = s.exploredParts[id]?.size ?? 0
        const quizCorrect = Object.values(s.quizResults[id] ?? {}).filter(
          Boolean,
        ).length
        systemProgress[id] = {
          explored,
          total: sys.parts.length,
          quizCorrect,
        }
      }
      return {
        xp: s.xp,
        totalClicks: s.totalClicks,
        totalQuizzes: s.totalQuizzes,
        totalCorrect: s.totalCorrect,
        currentStreak: s.currentStreak,
        bestStreak: s.bestStreak,
        perfectSystems: [...s.perfectSystems],
        systemProgress,
      }
    }

    case 'start_quiz': {
      return {
        message:
          'Click on any body part in the diagram, then press "Take the Quiz!" to start a quiz.',
      }
    }

    case 'get_systems': {
      return Object.entries(BODY_SYSTEMS).map(([id, sys]) => ({
        id,
        name: sys.name,
        partCount: sys.parts.length,
        description: sys.description,
      }))
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
