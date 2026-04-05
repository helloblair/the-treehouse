import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { calculateDecay, getMood } from './lib/decay'
import type { Pet } from './types'
import Onboarding from './components/Onboarding'
import PetView from './components/PetView'

const PLUGIN_ID = 'treehouse-pet'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || '*'
const PET_CACHE_KEY = 'chatbridge_pet_cache'

type ToolCallPayload = {
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

// XP thresholds for growth stages
const GROWTH_THRESHOLDS = { puppy: 0, junior: 100, adult: 300 }

function getGrowthStage(xp: number): Pet['growth_stage'] {
  if (xp >= GROWTH_THRESHOLDS.adult) return 'adult'
  if (xp >= GROWTH_THRESHOLDS.junior) return 'junior'
  return 'puppy'
}

function getFullState(pet: Pet) {
  const decayed = calculateDecay(pet)
  const merged = { ...pet, ...decayed } as Pet & { hunger: number; happiness: number; health: number }
  const mood = getMood(merged)
  return {
    name: merged.name,
    pet_type: merged.pet_type,
    mood,
    hunger: merged.hunger,
    happiness: merged.happiness,
    health: merged.health,
    growth_stage: merged.growth_stage,
    xp: merged.xp,
  }
}

// localStorage cache helpers
function cachePetToLocal(pet: Pet) {
  try {
    localStorage.setItem(PET_CACHE_KEY, JSON.stringify(pet))
  } catch { /* quota exceeded — ignore */ }
}

function loadPetFromLocal(): Pet | null {
  try {
    const raw = localStorage.getItem(PET_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Pet) : null
  } catch {
    return null
  }
}

type PendingWrite = {
  table: string
  id: string
  updates: Record<string, unknown>
}

// Fetch pet directly from Supabase by userId, with localStorage fallback
async function fetchPetFromDb(uid: string): Promise<Pet | null> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      cachePetToLocal(data as Pet)
      return data as Pet
    }
    return null
  } catch (err) {
    console.warn('[treehouse-pet] Supabase fetch failed, using localStorage cache:', err)
    return loadPetFromLocal()
  }
}

function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [ecstaticUntil, setEcstaticUntil] = useState(0)
  const [saving, setSaving] = useState(false)
  const petRef = useRef<Pet | null>(null)
  const userIdRef = useRef<string | null>(null)
  const initResolversRef = useRef<Array<() => void>>([])
  const pendingWritesRef = useRef<PendingWrite[]>([])

  // Keep refs in sync
  useEffect(() => {
    petRef.current = pet
  }, [pet])
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Write pet updates to Supabase with retry queue
  async function writePetToDb(petId: string, updates: Record<string, unknown>): Promise<Pet | null> {
    // First, try to flush any queued writes
    await flushPendingWrites()

    try {
      setSaving(true)
      const { data, error } = await supabase
        .from('pets')
        .update(updates)
        .eq('id', petId)
        .select()
        .single()
      if (error) throw error
      const updated = data as Pet
      cachePetToLocal(updated)
      setSaving(false)
      return updated
    } catch (err) {
      console.warn('[treehouse-pet] Supabase write failed, queuing for retry:', err)
      pendingWritesRef.current.push({ table: 'pets', id: petId, updates })
      if (!petRef.current) {
        setSaving(false)
        return null
      }
      // Optimistically update local state and cache
      const optimistic = { ...petRef.current, ...updates } as Pet
      cachePetToLocal(optimistic)
      setSaving(true) // keep indicator visible
      return optimistic
    }
  }

  async function flushPendingWrites() {
    if (pendingWritesRef.current.length === 0) return
    const toRetry = [...pendingWritesRef.current]
    pendingWritesRef.current = []
    for (const write of toRetry) {
      try {
        const { error } = await supabase
          .from(write.table)
          .update(write.updates)
          .eq('id', write.id)
        if (error) throw error
      } catch {
        // Put back for next attempt
        pendingWritesRef.current.push(write)
      }
    }
    if (pendingWritesRef.current.length === 0) {
      setSaving(false)
    }
  }

  // Wait for init_pet to complete (up to 5 seconds)
  function waitForInit(): Promise<void> {
    if (userIdRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000)
      initResolversRef.current.push(() => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  // Resolve current pet — waits for init, then checks ref, then Supabase fallback
  async function resolvePet(): Promise<Pet | null> {
    if (petRef.current) return petRef.current
    await waitForInit()
    if (petRef.current) return petRef.current
    if (!userIdRef.current) return null
    const fetched = await fetchPetFromDb(userIdRef.current)
    if (fetched) {
      setPet(fetched)
      petRef.current = fetched
    }
    return fetched
  }

  // Fetch existing pet from Supabase
  const checkForExistingPet = useCallback(async (uid: string) => {
    const fetched = await fetchPetFromDb(uid)
    if (fetched) {
      setPet(fetched)
      petRef.current = fetched // sync immediately, don't wait for useEffect
    }
    setLoading(false)
  }, [])

  // Handle tool calls from parent
  const handleToolCall = useCallback(
    async (msg: ToolCallPayload) => {
      const { callId, toolName, params } = msg.payload

      // Handle init_pet specially — sets userId
      if (toolName === 'init_pet') {
        const uid = params.userId as string
        setUserId(uid)
        userIdRef.current = uid
        await checkForExistingPet(uid)

        // Unblock any tool calls waiting for init
        for (const resolve of initResolversRef.current) resolve()
        initResolversRef.current = []

        // Signal ready after init complete
        window.parent.postMessage(
          { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
          PLATFORM_ORIGIN,
        )
        return
      }

      const currentPet = await resolvePet()
      if (!currentPet) {
        sendResult(callId, { error: 'No pet found' }, true)
        return
      }

      switch (toolName) {
        case 'get_pet_state': {
          sendResult(callId, getFullState(currentPet))
          break
        }

        case 'complete_task': {
          const xpGain = 20
          const newXp = currentPet.xp + xpGain
          const newStage = getGrowthStage(newXp)
          const newHappiness = Math.min(100, currentPet.happiness + 10)

          const updated = await writePetToDb(currentPet.id, {
            xp: newXp,
            growth_stage: newStage,
            happiness: newHappiness,
          })

          if (updated) {
            setPet(updated)
            petRef.current = updated
            const state = getFullState(updated)
            const evolved = newStage !== currentPet.growth_stage
            sendResult(callId, { ...state, xp_gained: xpGain, evolved, evolved_to: evolved ? newStage : null })
          } else {
            sendResult(callId, { error: 'Failed to update pet' }, true)
          }
          break
        }

        case 'play_with_pet': {
          const newHappiness = Math.min(100, currentPet.happiness + 30)

          const updated = await writePetToDb(currentPet.id, {
            last_played_at: new Date().toISOString(),
            happiness: newHappiness,
          })

          if (updated) {
            setPet(updated)
            petRef.current = updated
            setEcstaticUntil(Date.now() + 3000)
            sendResult(callId, getFullState(updated))
          } else {
            sendResult(callId, { error: 'Failed to update pet' }, true)
          }
          break
        }

        case 'check_pet_health': {
          const state = getFullState(currentPet)
          let summary = `${state.name} the ${state.pet_type} is `
          if (state.health > 80 && state.hunger > 80 && state.happiness > 80) {
            summary += 'in excellent shape! All stats are high.'
          } else if (state.health < 30) {
            summary += 'not feeling well. Health is critically low.'
          } else if (state.hunger < 30) {
            summary += 'getting hungry! Time for a snack.'
          } else if (state.happiness < 30) {
            summary += 'feeling a bit lonely. Some playtime would help!'
          } else {
            summary += 'doing okay, but could use some attention.'
          }
          sendResult(callId, { ...state, summary })
          break
        }

        case 'bathe_pet': {
          const newHappiness = Math.min(100, currentPet.happiness + 15)
          const newHealth = Math.min(100, currentPet.health + 5)

          const updated = await writePetToDb(currentPet.id, {
            happiness: newHappiness,
            health: newHealth,
            last_bathed_at: new Date().toISOString(),
          })

          if (updated) {
            setPet(updated)
            petRef.current = updated
            setEcstaticUntil(Date.now() + 2000)
            sendResult(callId, getFullState(updated))
          } else {
            sendResult(callId, { error: 'Failed to update pet' }, true)
          }
          break
        }

        case 'pet_the_pet': {
          const newHappiness = Math.min(100, currentPet.happiness + 10)
          const newHealth = Math.min(100, currentPet.health + 3)

          const updated = await writePetToDb(currentPet.id, {
            happiness: newHappiness,
            health: newHealth,
          })

          if (updated) {
            setPet(updated)
            petRef.current = updated
            sendResult(callId, getFullState(updated))
          } else {
            sendResult(callId, { error: 'Failed to update pet' }, true)
          }
          break
        }

        default:
          sendResult(callId, { error: `Unknown tool: ${toolName}` }, true)
      }
    },
    [checkForExistingPet],
  )

  // Listen for postMessage from parent
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
      const data = event.data
      if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
        void handleToolCall(data as ToolCallPayload)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleToolCall])

  // Signal initial ready on mount so PluginHost can send init_pet
  useEffect(() => {
    window.parent.postMessage(
      { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
      PLATFORM_ORIGIN,
    )
  }, [])

  // Clear ecstatic override after timeout
  useEffect(() => {
    if (ecstaticUntil <= Date.now()) return
    const timer = setTimeout(() => setEcstaticUntil(0), ecstaticUntil - Date.now())
    return () => clearTimeout(timer)
  }, [ecstaticUntil])

  // Before userId is set, show a loading state
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
        Loading your pet...
      </div>
    )
  }

  if (!pet) {
    return (
      <Onboarding
        userId={userId}
        onComplete={(newPet) => {
          setPet(newPet)
          petRef.current = newPet
        }}
      />
    )
  }

  return (
    <>
      <PetView
        pet={pet}
        onPetUpdate={(updated) => {
          setPet(updated)
          petRef.current = updated
        }}
      />
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
    </>
  )
}

export default App
