/**
 * Parent-side persistence for plugin state.
 *
 * Saves to / loads from the `plugin_states` Supabase table so that
 * plugin state (drawings, chess games, anatomy progress, pioneer journeys)
 * survives across app restarts.
 *
 * Writes are debounced per-plugin so rapid state updates (e.g. every
 * pixel-art stroke) don't hammer the database.
 */
import { supabase } from './supabase'

const SAVE_DEBOUNCE_MS = 2_000

interface PendingSave {
  timer: ReturnType<typeof setTimeout>
  userId: string
  pluginId: string
  state: unknown
}

const pendingSaves = new Map<string, PendingSave>()

async function doSave(userId: string, pluginId: string, state: unknown): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.rpc('upsert_plugin_state', {
      p_user_id: userId,
      p_plugin_id: pluginId,
      p_state: state,
    })
    if (error) {
      console.warn(`[pluginPersistence] Failed to save state for ${pluginId}:`, error.message)
    }
  } catch (err) {
    console.warn(`[pluginPersistence] Failed to save state for ${pluginId}:`, err)
  }
}

/**
 * Load a plugin's persisted state from Supabase.
 * Returns `null` if no row exists or Supabase is unavailable.
 */
export async function loadPluginState(
  userId: string,
  pluginId: string,
): Promise<unknown | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('plugin_states')
      .select('state')
      .eq('user_id', userId)
      .eq('plugin_id', pluginId)
      .single()
    if (error || !data) return null
    return data.state
  } catch {
    return null
  }
}

/**
 * Persist a plugin's state to Supabase (debounced).
 * Calls are coalesced per `userId:pluginId` — only the latest state is saved.
 */
export function savePluginState(
  userId: string,
  pluginId: string,
  state: unknown,
): void {
  if (!supabase) return
  const key = `${userId}:${pluginId}`

  const existing = pendingSaves.get(key)
  if (existing) clearTimeout(existing.timer)

  const timer = setTimeout(() => {
    pendingSaves.delete(key)
    void doSave(userId, pluginId, state)
  }, SAVE_DEBOUNCE_MS)

  pendingSaves.set(key, { timer, userId, pluginId, state })
}

/**
 * Flush any pending debounced saves immediately (e.g. before app close).
 * Fires all pending writes without waiting for the debounce timer.
 */
export function flushPendingSaves(): void {
  for (const [key, pending] of pendingSaves.entries()) {
    clearTimeout(pending.timer)
    pendingSaves.delete(key)
    void doSave(pending.userId, pending.pluginId, pending.state)
  }
}
