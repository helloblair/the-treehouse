import type { PlayerStats } from '../types'
import { BODY_SYSTEMS } from '../data/systems'

/** Read-only tool: build progress summary from current stats. */
export function getProgress(stats: PlayerStats) {
  const systemProgress: Record<
    string,
    { explored: number; total: number; quizCorrect: number }
  > = {}
  for (const [id, sys] of Object.entries(BODY_SYSTEMS)) {
    const explored = stats.exploredParts[id]?.size ?? 0
    const quizCorrect = Object.values(stats.quizResults[id] ?? {}).filter(
      Boolean,
    ).length
    systemProgress[id] = { explored, total: sys.parts.length, quizCorrect }
  }
  return {
    xp: stats.xp,
    totalClicks: stats.totalClicks,
    totalQuizzes: stats.totalQuizzes,
    totalCorrect: stats.totalCorrect,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    perfectSystems: [...stats.perfectSystems],
    systemProgress,
  }
}

/** Read-only tool: list all available systems. */
export function getSystems() {
  return Object.entries(BODY_SYSTEMS).map(([id, sys]) => ({
    id,
    name: sys.name,
    partCount: sys.parts.length,
    description: sys.description,
  }))
}

/** Read-only tool: get a specific part's info + quiz data. */
export function getPartInfo(systemId: string, partId: string) {
  const sys = BODY_SYSTEMS[systemId]
  if (!sys) return { error: `Unknown system: ${systemId}` }
  const part = sys.parts.find((p) => p.id === partId)
  if (!part) return { error: `Unknown part: ${partId} in ${systemId}` }
  return {
    systemId,
    systemName: sys.name,
    partId: part.id,
    partName: part.name,
    info: part.info,
    quiz: part.quiz,
    answer: part.answer,
    options: part.options,
  }
}
