import type { TreehouseToolCall } from '../types'
import type { PlayerStats } from '../types'

const PLUGIN_ID = 'treehouse-body'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || 'http://localhost:1212'

type ToolHandler = (
  toolName: string,
  params: Record<string, unknown>,
) => unknown | Promise<unknown>

type RestoreHandler = (stats: PlayerStats) => void

let toolHandler: ToolHandler | null = null
let restoreHandler: RestoreHandler | null = null

// ─── Serialization ─────────────────────────────────────────────────
// PlayerStats uses Set<string> which isn't JSON-serializable.
// Convert Sets → arrays for storage and arrays → Sets for restore.

interface SerializedStats {
  totalClicks: number
  totalQuizzes: number
  totalCorrect: number
  currentStreak: number
  bestStreak: number
  exploredParts: Record<string, string[]>
  quizResults: Record<string, Record<string, boolean>>
  perfectSystems: string[]
  xp: number
}

export function serializeStats(s: PlayerStats): SerializedStats {
  const exploredParts: Record<string, string[]> = {}
  for (const [key, set] of Object.entries(s.exploredParts)) {
    exploredParts[key] = [...set]
  }
  return {
    totalClicks: s.totalClicks,
    totalQuizzes: s.totalQuizzes,
    totalCorrect: s.totalCorrect,
    currentStreak: s.currentStreak,
    bestStreak: s.bestStreak,
    exploredParts,
    quizResults: s.quizResults,
    perfectSystems: [...s.perfectSystems],
    xp: s.xp,
  }
}

export function deserializeStats(raw: SerializedStats): PlayerStats {
  const exploredParts: Record<string, Set<string>> = {}
  for (const [key, arr] of Object.entries(raw.exploredParts ?? {})) {
    exploredParts[key] = new Set(arr)
  }
  return {
    totalClicks: raw.totalClicks ?? 0,
    totalQuizzes: raw.totalQuizzes ?? 0,
    totalCorrect: raw.totalCorrect ?? 0,
    currentStreak: raw.currentStreak ?? 0,
    bestStreak: raw.bestStreak ?? 0,
    exploredParts,
    quizResults: raw.quizResults ?? {},
    perfectSystems: new Set(raw.perfectSystems ?? []),
    xp: raw.xp ?? 0,
  }
}

// ─── Outbound messages ─────────────────────────────────────────────

export function sendResult(
  callId: string,
  result: unknown,
  isError = false,
) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_TOOL_RESULT',
      pluginId: PLUGIN_ID,
      payload: { callId, result, isError },
    },
    PLATFORM_ORIGIN,
  )
}

export function sendReady() {
  window.parent.postMessage(
    { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
    PLATFORM_ORIGIN,
  )
}

export function sendStateUpdate(stats: PlayerStats, userMessage?: string) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_STATE_UPDATE',
      pluginId: PLUGIN_ID,
      payload: { state: serializeStats(stats), userMessage },
    },
    PLATFORM_ORIGIN,
  )
}

// ─── Inbound message listener ──────────────────────────────────────

function onMessage(event: MessageEvent) {
  if (event.origin !== PLATFORM_ORIGIN) return
  const data = event.data

  if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
    const { callId, toolName, params } = (data as TreehouseToolCall).payload
    if (!toolHandler) {
      sendResult(callId, { error: 'No tool handler registered' }, true)
      return
    }
    void Promise.resolve(toolHandler(toolName, params)).then(
      (result) => sendResult(callId, result),
      (err: unknown) =>
        sendResult(
          callId,
          { error: err instanceof Error ? err.message : String(err) },
          true,
        ),
    )
  }

  if (data?.type === 'TREEHOUSE_RESTORE_STATE' && data?.pluginId === PLUGIN_ID) {
    const raw = data.payload?.state as SerializedStats | undefined
    if (raw && restoreHandler) {
      restoreHandler(deserializeStats(raw))
    }
  }
}

// ─── Init / teardown ───────────────────────────────────────────────

export function initMessaging(handler: ToolHandler, onRestore?: RestoreHandler) {
  toolHandler = handler
  restoreHandler = onRestore ?? null
  window.addEventListener('message', onMessage)
  sendReady()
  return () => {
    window.removeEventListener('message', onMessage)
    toolHandler = null
    restoreHandler = null
  }
}
