import { useState, useEffect, useCallback, useRef } from 'react'
import type { PioneerGameState } from './lib/gameState'
import { createInitialState } from './lib/gameState'
import { advanceDays, resolveCurrentEvent, applyHuntResult, applyRiverResult, tradeAtFort, restAtLandmark, simulateHunt, simulateRiverCrossing } from './lib/engine'
import { LANDMARKS } from './lib/route'
import { supabase } from './lib/supabase'
import TrailMap from './components/TrailMap'
import Hunt from './components/Hunt'
import RiverCrossing from './components/RiverCrossing'

const PLUGIN_ID = 'treehouse-pioneer'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || 'http://localhost:1212'
const GAME_CACHE_KEY = 'chatbridge_pioneer_cache'

interface ToolCallPayload {
  type: 'TREEHOUSE_TOOL_CALL'
  pluginId: string
  payload: {
    callId: string
    toolName: string
    params: Record<string, unknown>
  }
}

function sendResult(callId: string, result: unknown, isError = false) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_TOOL_RESULT',
      pluginId: PLUGIN_ID,
      payload: { callId, result, isError },
    },
    PLATFORM_ORIGIN,
  )
}

function sendStateUpdate(state: PioneerGameState, userMessage?: string) {
  window.parent.postMessage(
    {
      type: 'TREEHOUSE_STATE_UPDATE',
      pluginId: PLUGIN_ID,
      payload: { state, userMessage },
    },
    PLATFORM_ORIGIN,
  )
}

function sendCompletion(state: PioneerGameState) {
  const survivors = state.party.filter((p) => p.alive).length
  const deaths = state.party.filter((p) => !p.alive).length

  if (state.phase === 'victory') {
    window.parent.postMessage(
      {
        type: 'TREEHOUSE_COMPLETION',
        pluginId: PLUGIN_ID,
        payload: {
          result: {
            summary: `${survivors} of 5 pioneers reached Valley's End in ${state.day} days. ${deaths > 0 ? `${deaths} members were lost on the trail.` : 'The whole party survived.'}`,
            data: { outcome: 'victory', days: state.day, miles: 2040, survivors, deaths, party: state.party },
          },
        },
      },
      PLATFORM_ORIGIN,
    )
  } else if (state.phase === 'gameover') {
    window.parent.postMessage(
      {
        type: 'TREEHOUSE_COMPLETION',
        pluginId: PLUGIN_ID,
        payload: {
          result: {
            summary: `The party perished on the trail after ${state.day} days and ${state.miles} miles. Cause: ${state.causeOfDeath}.`,
            data: { outcome: 'gameover', days: state.day, miles: state.miles, causeOfDeath: state.causeOfDeath, party: state.party },
          },
        },
      },
      PLATFORM_ORIGIN,
    )
  }
}

function getAvailableActions(state: PioneerGameState): string[] {
  switch (state.phase) {
    case 'travel':
      return ['continue (advance_days)', 'hunt (make_decision: hunt)', 'set_pace (make_decision)', 'set_rations (make_decision)']
    case 'landmark':
      return ['continue (make_decision: continue)', 'rest (make_decision: rest)', 'hunt (make_decision: hunt)', 'trade (make_decision: trade)']
    case 'river':
      return ['ford the river (cross_river: ford)', 'caulk and float (cross_river: caulk)', 'take ferry for $5 (cross_river: ferry)']
    case 'event':
      return (state.activeEvent?.choices ?? []).map((c, i) => `${c.label} (resolve_event: choice_index ${i})`)
    case 'hunt':
      return ['waiting for hunt to complete in plugin panel']
    default:
      return []
  }
}

function serializeState(state: PioneerGameState) {
  return {
    day: state.day,
    miles: state.miles,
    pace: state.pace,
    rations: state.rations,
    supplies: state.supplies,
    party: state.party.map((p) => ({
      name: p.name,
      health: p.health,
      illness: p.illness ?? null,
      alive: p.alive,
    })),
    currentLandmark: state.currentLandmark,
    nextLandmark: state.nextLandmark,
    milesUntilNextLandmark: state.milesUntilNextLandmark,
    weather: state.weather,
    month: state.month,
    phase: state.phase,
    activeEvent: state.activeEvent,
    ...(state.phase === 'river' ? { riverDepth: state.riverDepth } : {}),
    availableActions: getAvailableActions(state),
    recentLog: state.log.slice(-5),
  }
}

// --- Supabase persistence helpers ---

function isValidGameState(obj: unknown): obj is PioneerGameState {
  if (!obj || typeof obj !== 'object') return false
  const s = obj as Record<string, unknown>
  return (
    typeof s.day === 'number' &&
    typeof s.miles === 'number' &&
    typeof s.pace === 'string' &&
    typeof s.rations === 'string' &&
    s.supplies != null && typeof s.supplies === 'object' &&
    Array.isArray(s.party) && s.party.length > 0 &&
    typeof s.phase === 'string' &&
    Array.isArray(s.log)
  )
}

function cacheGameToLocal(game: PioneerGameState, dbId: string) {
  try {
    localStorage.setItem(GAME_CACHE_KEY, JSON.stringify({ ...game, _dbId: dbId }))
  } catch { /* quota exceeded — ignore */ }
}

function loadGameFromLocal(): { game: PioneerGameState; dbId: string } | null {
  try {
    const raw = localStorage.getItem(GAME_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const { _dbId, ...game } = parsed
    return _dbId ? { game: game as PioneerGameState, dbId: _dbId } : null
  } catch {
    return null
  }
}

function gameToRow(game: PioneerGameState, userId: string) {
  return {
    user_id: userId,
    day: game.day,
    miles: game.miles,
    pace: game.pace,
    rations: game.rations,
    supplies: game.supplies,
    party: game.party,
    current_landmark: game.currentLandmark,
    next_landmark: game.nextLandmark,
    miles_until_next_landmark: game.milesUntilNextLandmark,
    weather: game.weather,
    month: game.month,
    phase: game.phase,
    active_event: game.activeEvent,
    river_depth: game.riverDepth ?? null,
    cause_of_death: game.causeOfDeath ?? null,
    log: game.log.slice(-150),
  }
}

function rowToGame(row: Record<string, unknown>): PioneerGameState {
  return {
    day: row.day as number,
    miles: row.miles as number,
    totalMiles: 2040,
    pace: row.pace as PioneerGameState['pace'],
    rations: row.rations as PioneerGameState['rations'],
    supplies: row.supplies as PioneerGameState['supplies'],
    party: row.party as PioneerGameState['party'],
    currentLandmark: row.current_landmark as string,
    nextLandmark: row.next_landmark as string,
    milesUntilNextLandmark: row.miles_until_next_landmark as number,
    weather: row.weather as PioneerGameState['weather'],
    month: row.month as number,
    phase: row.phase as PioneerGameState['phase'],
    activeEvent: (row.active_event as PioneerGameState['activeEvent']) ?? null,
    riverDepth: row.river_depth as number | undefined,
    causeOfDeath: row.cause_of_death as string | undefined,
    log: (row.log as string[]) ?? [],
  }
}

async function fetchGameFromDb(userId: string): Promise<{ game: PioneerGameState; dbId: string } | null> {
  try {
    const { data, error } = await supabase
      .from('pioneer_games')
      .select('*')
      .eq('user_id', userId)
      .not('phase', 'in', '("gameover","victory")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const game = rowToGame(data)
      cacheGameToLocal(game, data.id)
      return { game, dbId: data.id }
    }
    return null
  } catch (err) {
    console.warn('[treehouse-pioneer] Supabase fetch failed, using localStorage cache:', err)
    return loadGameFromLocal()
  }
}

async function insertGameToDb(game: PioneerGameState, userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('pioneer_games')
      .insert(gameToRow(game, userId))
      .select('id')
      .single()
    if (error) throw error
    cacheGameToLocal(game, data.id)
    return data.id
  } catch (err) {
    console.warn('[treehouse-pioneer] Supabase insert failed:', err)
    return null
  }
}

async function updateGameInDb(dbId: string, game: PioneerGameState, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('pioneer_games')
      .update(gameToRow(game, userId))
      .eq('id', dbId)
    if (error) throw error
    cacheGameToLocal(game, dbId)
    return true
  } catch (err) {
    console.warn('[treehouse-pioneer] Supabase update failed:', err)
    // Optimistically cache locally
    cacheGameToLocal(game, dbId)
    return false
  }
}

// Health color dot
function healthColor(health: string, alive: boolean): string {
  if (!alive) return '#555'
  switch (health) {
    case 'good': return '#4CAF50'
    case 'fair': return '#FFD700'
    case 'poor': return '#FF9800'
    case 'very poor': return '#F44336'
    default: return '#888'
  }
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [game, setGame] = useState<PioneerGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const gameRef = useRef<PioneerGameState | null>(null)
  const userIdRef = useRef<string | null>(null)
  const dbIdRef = useRef<string | null>(null)
  const initResolversRef = useRef<Array<() => void>>([])

  // Keep refs in sync
  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Save game state to Supabase (debounced writes)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveToDb = useCallback((state: PioneerGameState) => {
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const uid = userIdRef.current
      if (!uid) return
      setSaving(true)
      if (dbIdRef.current) {
        await updateGameInDb(dbIdRef.current, state, uid)
      } else {
        const newId = await insertGameToDb(state, uid)
        if (newId) dbIdRef.current = newId
      }
      setSaving(false)
    }, 500)
  }, [])

  const updateGame = useCallback((newState: PioneerGameState) => {
    setGame(newState)
    sendStateUpdate(newState)
    saveToDb(newState)
    if (newState.phase === 'victory' || newState.phase === 'gameover') {
      sendCompletion(newState)
    }
  }, [saveToDb])

  // Fetch existing game from Supabase
  const checkForExistingGame = useCallback(async (uid: string) => {
    const result = await fetchGameFromDb(uid)
    if (result) {
      setGame(result.game)
      gameRef.current = result.game
      dbIdRef.current = result.dbId
    }
    setLoading(false)
  }, [])

  const handleToolCall = useCallback((data: ToolCallPayload) => {
    const { callId, toolName, params } = data.payload

    // Handle init_pioneer — sets userId
    if (toolName === 'init_pioneer') {
      const uid = params.userId as string
      setUserId(uid)
      userIdRef.current = uid
      void checkForExistingGame(uid).then(() => {
        for (const resolve of initResolversRef.current) resolve()
        initResolversRef.current = []
        window.parent.postMessage(
          { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
          PLATFORM_ORIGIN,
        )
      })
      return
    }

    switch (toolName) {
      case 'start_journey': {
        const rawNames = params.party_names
        const names = Array.isArray(rawNames) ? rawNames as string[] : ['Pioneer 1', 'Pioneer 2', 'Pioneer 3', 'Pioneer 4', 'Pioneer 5']
        const money = typeof params.starting_money === 'number' ? params.starting_money : 800
        const initial = createInitialState(names.slice(0, 5), Math.max(100, Math.min(1600, money)))
        // New game — clear old dbId so we insert fresh
        dbIdRef.current = null
        updateGame(initial)
        sendResult(callId, serializeState(initial))
        break
      }
      case 'get_journey_state': {
        const s = gameRef.current
        if (!s) {
          sendResult(callId, { error: 'No active game. Call start_journey first.' }, true)
        } else {
          sendResult(callId, serializeState(s))
        }
        break
      }
      case 'make_decision': {
        const s = gameRef.current
        if (!s) {
          sendResult(callId, { error: 'No active game.' }, true)
          break
        }
        if (s.phase === 'gameover' || s.phase === 'victory') {
          sendResult(callId, { error: `Game is over (${s.phase}). Cannot make decisions.` }, true)
          break
        }
        if (s.phase === 'river') {
          sendResult(callId, { error: 'At a river crossing. Use cross_river tool instead.' }, true)
          break
        }
        if (s.phase === 'event') {
          sendResult(callId, { error: 'An event is active. Use resolve_event tool instead.' }, true)
          break
        }
        const decision = params.decision as string
        let next = { ...s, supplies: { ...s.supplies }, party: s.party.map((p) => ({ ...p })), log: [...s.log] }

        switch (decision) {
          case 'set_pace_steady': next.pace = 'steady'; next.log.push('Pace set to steady.'); break
          case 'set_pace_strenuous': next.pace = 'strenuous'; next.log.push('Pace set to strenuous.'); break
          case 'set_pace_grueling': next.pace = 'grueling'; next.log.push('Pace set to grueling.'); break
          case 'set_rations_filling': next.rations = 'filling'; next.log.push('Rations set to filling.'); break
          case 'set_rations_meager': next.rations = 'meager'; next.log.push('Rations set to meager.'); break
          case 'set_rations_bare_bones': next.rations = 'bare bones'; next.log.push('Rations set to bare bones.'); break
          case 'rest': next = restAtLandmark(s); break
          case 'continue': next.phase = 'travel'; next.log.push('Continuing the journey.'); break
          case 'hunt': {
            next = simulateHunt(s)
            break
          }
          case 'trade': {
            const item = params.trade_item as string
            const qty = typeof params.trade_quantity === 'number' ? params.trade_quantity : 1
            next = tradeAtFort(s, item, qty)
            break
          }
          default:
            sendResult(callId, { error: `Unknown decision: ${decision}` }, true)
            return
        }
        updateGame(next)
        sendResult(callId, serializeState(next))
        break
      }
      case 'resolve_event': {
        const s = gameRef.current
        if (!s || !s.activeEvent) {
          sendResult(callId, { error: 'No active event.' }, true)
          break
        }
        const idx = typeof params.choice_index === 'number' ? params.choice_index : 0
        const next = resolveCurrentEvent(s, idx)
        updateGame(next)
        sendResult(callId, serializeState(next))
        break
      }
      case 'advance_days': {
        const s = gameRef.current
        if (!s) {
          sendResult(callId, { error: 'No active game.' }, true)
          break
        }
        if (s.phase === 'gameover' || s.phase === 'victory') {
          sendResult(callId, { error: `Game is over (${s.phase}). Cannot advance.` }, true)
          break
        }
        if (s.phase !== 'travel') {
          sendResult(callId, { error: `Cannot advance days during ${s.phase} phase. Resolve current situation first.` }, true)
          break
        }
        const days = typeof params.days === 'number' ? Math.max(1, Math.min(7, params.days)) : 1
        const next = advanceDays(s, days)
        updateGame(next)
        sendResult(callId, serializeState(next))
        break
      }
      case 'cross_river': {
        const s = gameRef.current
        if (!s) {
          sendResult(callId, { error: 'No active game.' }, true)
          break
        }
        if (s.phase !== 'river') {
          sendResult(callId, { error: 'Not at a river crossing. Current phase: ' + s.phase }, true)
          break
        }
        const method = params.method as 'ford' | 'caulk' | 'ferry'
        if (!['ford', 'caulk', 'ferry'].includes(method)) {
          sendResult(callId, { error: 'Invalid method. Use: ford, caulk, or ferry.' }, true)
          break
        }
        const next = simulateRiverCrossing(s, method)
        updateGame(next)
        sendResult(callId, serializeState(next))
        break
      }
      default:
        sendResult(callId, { error: `Unknown tool: ${toolName}` }, true)
    }
  }, [updateGame, checkForExistingGame])

  // postMessage listener
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
      const data = event.data
      if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
        handleToolCall(data as ToolCallPayload)
      }
      if (data?.type === 'TREEHOUSE_RESTORE_STATE' && data?.pluginId === PLUGIN_ID) {
        const restored = data.payload?.state
        if (restored && isValidGameState(restored)) {
          setGame(restored)
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleToolCall])

  // Send READY on mount so PluginHost can send init_pioneer
  useEffect(() => {
    window.parent.postMessage({ type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID }, PLATFORM_ORIGIN)
  }, [])

  // Standalone detection: redirect to main app if not in an iframe
  if (window.parent === window) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
        textAlign: 'center',
        padding: 24,
      }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12, color: '#f8fafc' }}>This app runs inside The Treehouse</h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
            It's designed to be embedded in the chat experience, not visited directly.
          </p>
          <a
            href="https://thetreehouse.vercel.app"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Go to The Treehouse
          </a>
        </div>
      </div>
    )
  }

  // --- No userId yet ---
  if (!userId) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
        Connecting...
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
        Loading your journey...
      </div>
    )
  }

  // --- No game started yet ---
  if (!game) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20, textAlign: 'center' }}>
        <div>
          <h2 style={{ color: '#C4A35A', marginBottom: 8, fontSize: 20 }}>THE PIONEER PATH</h2>
          <p style={{ fontSize: 13, opacity: 0.7 }}>Waiting for the journey to begin...</p>
          <p style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>Ask Claude: "Let's play Pioneer Path"</p>
        </div>
      </div>
    )
  }

  const aliveParty = game.party.filter((p) => p.alive).map((p) => p.name)
  const currentLandmarkData = LANDMARKS.find((l) => l.name === game.currentLandmark)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Map - always visible */}
      <div style={{ padding: '8px 8px 0' }}>
        <TrailMap miles={game.miles} day={game.day} currentLandmark={game.currentLandmark} />
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {/* --- TRAVEL PHASE --- */}
        {game.phase === 'travel' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13, flexWrap: 'wrap' }}>
              <div>
                <label>Pace: </label>
                <select value={game.pace} onChange={(e) => {
                  const next = { ...game, pace: e.target.value as PioneerGameState['pace'], log: [...game.log] }
                  updateGame(next)
                }}>
                  <option value="steady">Steady</option>
                  <option value="strenuous">Strenuous</option>
                  <option value="grueling">Grueling</option>
                </select>
              </div>
              <div>
                <label>Rations: </label>
                <select value={game.rations} onChange={(e) => {
                  const next = { ...game, rations: e.target.value as PioneerGameState['rations'], log: [...game.log] }
                  updateGame(next)
                }}>
                  <option value="filling">Filling</option>
                  <option value="meager">Meager</option>
                  <option value="bare bones">Bare bones</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={() => {
                const next = advanceDays(game, 1)
                updateGame(next)
                if (next.phase === 'event' && next.activeEvent) {
                  sendStateUpdate(next, `A trail event has occurred: ${next.activeEvent.description}`)
                }
              }}>
                Continue (1 day)
              </button>
              <button onClick={() => {
                const next = advanceDays(game, 7)
                updateGame(next)
                if (next.phase === 'event' && next.activeEvent) {
                  sendStateUpdate(next, `A trail event has occurred: ${next.activeEvent.description}`)
                }
              }}>
                Travel (7 days)
              </button>
              <button onClick={() => updateGame({ ...game, phase: 'hunt', log: [...game.log] })} disabled={game.supplies.ammunition <= 0}>
                Hunt
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Next: {game.nextLandmark} ({game.milesUntilNextLandmark} mi) | Weather: {game.weather}
            </div>
          </div>
        )}

        {/* --- LANDMARK PHASE --- */}
        {game.phase === 'landmark' && currentLandmarkData && (
          <div>
            <h3 style={{ color: '#C4A35A', marginBottom: 4, fontSize: 16 }}>{game.currentLandmark}</h3>
            <p style={{ fontSize: 13, marginBottom: 8, opacity: 0.8 }}>{currentLandmarkData.description}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => updateGame({ ...game, phase: 'travel', log: [...game.log, 'Continuing the journey.'] })}>
                Continue
              </button>
              <button onClick={() => {
                const next = restAtLandmark(game)
                updateGame(next)
              }}>
                Rest (3 days)
              </button>
              {currentLandmarkData.isFort && (
                <button onClick={() => {
                  sendStateUpdate(game, `I'm at ${game.currentLandmark}. What should I trade for?`)
                }}>
                  Trade
                </button>
              )}
              <button onClick={() => updateGame({ ...game, phase: 'hunt', log: [...game.log] })} disabled={game.supplies.ammunition <= 0}>
                Hunt
              </button>
            </div>
          </div>
        )}

        {/* --- HUNT PHASE --- */}
        {game.phase === 'hunt' && (
          <Hunt
            maxAmmo={Math.min(20, game.supplies.ammunition)}
            onComplete={(food, ammo) => {
              const next = applyHuntResult(game, food, ammo)
              updateGame(next)
              sendResult('hunt-result', { food_gained: food, ammo_spent: ammo })
              sendStateUpdate(next, `Hunting complete! Gained ${food} lbs of food, used ${ammo} bullets.`)
            }}
          />
        )}

        {/* --- RIVER PHASE --- */}
        {game.phase === 'river' && (
          <RiverCrossing
            landmarkName={game.currentLandmark}
            partyNames={aliveParty}
            money={game.supplies.money}
            depth={game.riverDepth ?? 3}
            onResult={(method, success, losses) => {
              const next = applyRiverResult(game, method, success, losses)
              updateGame(next)
              sendStateUpdate(next, success
                ? `Crossed ${game.currentLandmark} by ${method} successfully!`
                : `River crossing failed! ${losses.pioneers.length > 0 ? `Lost ${losses.pioneers.join(', ')} in the water.` : `Lost ${losses.food} lbs of food.`}`)
            }}
          />
        )}

        {/* --- EVENT PHASE --- */}
        {game.phase === 'event' && game.activeEvent && (
          <div>
            <h3 style={{ color: '#FF9800', marginBottom: 4, fontSize: 16 }}>TRAIL EVENT</h3>
            <p style={{ fontSize: 13, marginBottom: 8 }}>{game.activeEvent.description}</p>
            {game.activeEvent.choices.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {game.activeEvent.choices.map((c, i) => (
                  <button key={i} onClick={() => {
                    const next = resolveCurrentEvent(game, i)
                    updateGame(next)
                    sendStateUpdate(next, `Event resolved: chose "${c.label}". ${next.log[next.log.length - 1]}`)
                  }}>
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => {
                const next = resolveCurrentEvent(game, 0)
                updateGame(next)
                sendStateUpdate(next, `Event resolved: ${next.log[next.log.length - 1]}`)
              }}>
                Continue
              </button>
            )}
          </div>
        )}

        {/* --- GAME OVER --- */}
        {game.phase === 'gameover' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <h2 style={{ color: '#F44336', marginBottom: 8 }}>THE JOURNEY ENDS</h2>
            <p style={{ fontSize: 14, marginBottom: 4 }}>{game.causeOfDeath}</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Day {game.day} — {game.miles} miles traveled
            </p>
            <div style={{ marginTop: 8 }}>
              {game.party.map((p) => (
                <span key={p.name} style={{ marginRight: 8, fontSize: 12, color: p.alive ? '#4CAF50' : '#F44336' }}>
                  {p.name}: {p.alive ? 'survived' : 'lost'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* --- VICTORY --- */}
        {game.phase === 'victory' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <h2 style={{ color: '#FFD700', marginBottom: 8 }}>VALLEY'S END!</h2>
            <p style={{ fontSize: 14, marginBottom: 4 }}>You have reached your destination!</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Arrived on day {game.day} — {game.party.filter((p) => p.alive).length} of {game.party.length} survived
            </p>
            <div style={{ marginTop: 8 }}>
              {game.party.map((p) => (
                <span key={p.name} style={{ marginRight: 8, fontSize: 12, color: p.alive ? '#4CAF50' : '#F44336' }}>
                  {p.name}: {p.alive ? 'arrived!' : 'lost on trail'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid #5C3D1E', padding: '6px 8px', fontSize: 11, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', background: '#1E0F04' }}>
        <span>Food: {game.supplies.food} lbs</span>
        <span>Oxen: {game.supplies.oxen}</span>
        <span>Clothing: {game.supplies.clothing}</span>
        <span>Ammo: {game.supplies.ammunition}</span>
        <span>Medicine: {game.supplies.medicine}</span>
        <span>${game.supplies.money}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {game.party.map((p) => (
            <span key={p.name} title={`${p.name}: ${p.alive ? p.health : 'dead'}${p.illness ? ` (${p.illness})` : ''}`}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: healthColor(p.health, p.alive),
                verticalAlign: 'middle',
              }} />
              <span style={{ marginLeft: 2, opacity: p.alive ? 1 : 0.4 }}>{p.name.split(' ')[0]}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Event log */}
      <div style={{ borderTop: '1px solid #5C3D1E', padding: '4px 8px', fontSize: 11, maxHeight: 80, overflowY: 'auto', background: '#150A02', opacity: 0.8 }}>
        {game.log.slice(-5).map((entry, i) => (
          <div key={i} style={{ marginBottom: 2 }}>{'> '}{entry}</div>
        ))}
      </div>

      {saving && (
        <div
          style={{
            position: 'fixed',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          Saving...
        </div>
      )}
    </div>
  )
}
