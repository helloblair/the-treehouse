import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import platform from '@/platform'
import { supabase } from '@/lib/supabase'
import { pluginStore } from '@/stores/pluginStore'

const AUTH_TOKEN_KEY = 'treehouse_auth_token'

interface AuthUser {
  email: string
  userId: string
  role: 'teacher' | 'student' | 'support'
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Simple event emitter so useAuth re-runs after sign-in / sign-out
let authVersion = 0
const listeners = new Set<() => void>()
function notifyAuthChange() {
  authVersion++
  for (const l of listeners) l()
}
function subscribeAuth(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
function getAuthVersion() {
  return authVersion
}

export async function getAuthToken(): Promise<string | null> {
  return platform.getStoreValue(AUTH_TOKEN_KEY)
}

// Expose getAuthToken to non-React code (notably the Claude provider's proxy
// fetch wrapper in src/shared, which can't import renderer modules) so the
// /api/claude edge function can authenticate every request. The wrapper reads
// `globalThis.__treehouseGetAuthToken` at request time and forwards the JWT.
if (typeof globalThis !== 'undefined') {
  ;(globalThis as { __treehouseGetAuthToken?: () => Promise<string | null> }).__treehouseGetAuthToken =
    getAuthToken
}

export async function setAuthToken(token: string): Promise<void> {
  await platform.setStoreValue(AUTH_TOKEN_KEY, token)
  notifyAuthChange()
}

export async function clearAuthToken(): Promise<void> {
  await platform.delStoreValue(AUTH_TOKEN_KEY)
  notifyAuthChange()
}

export async function validateToken(token: string): Promise<AuthUser | null> {
  try {
    // Decode the Supabase JWT payload locally (no network request).
    // The token was issued by our Supabase instance and stored by us — safe to trust.
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) return null

    const email = payload.email as string | undefined
    const userId = payload.sub as string | undefined
    if (!email || !userId) return null

    // Role is read exclusively from user_profiles. JWT user_metadata is set
    // by the user themselves at signup (via the `data:` field on signUp), so
    // it is forgeable and must never be trusted for privileged decisions.
    // Direct client writes to user_profiles.role are blocked by column-level
    // grants — see supabase/migrations/20260407_lock_role_column.sql.
    let role: 'teacher' | 'student' | 'support' = 'student'
    if (supabase) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single()
      if (profile?.role === 'support') role = 'support'
      else if (profile?.role === 'teacher') role = 'teacher'
    }

    return { email, userId, role }
  } catch {
    return null
  }
}

export function useAuth(): AuthState {
  const version = useSyncExternalStore(subscribeAuth, getAuthVersion)

  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAuthToken()
      if (cancelled) return

      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false })
        return
      }

      const user = await validateToken(token)
      if (cancelled) return

      if (user) {
        setState({ user, isLoading: false, isAuthenticated: true })
      } else {
        await clearAuthToken()
        setState({ user: null, isLoading: false, isAuthenticated: false })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [version])

  return state
}

export function useSignOut() {
  return useCallback(async () => {
    // Wipe per-user secrets that the next signed-in user must not inherit on
    // shared devices (school computers, family iPads). Plugin OAuth tokens
    // are scoped to whoever authorized them, not to the current Supabase
    // session, so they leak across users unless we clear them explicitly.
    try {
      pluginStore.setState((state) => {
        state.oauthTokens = {}
        state.pluginStates = {}
      })
      // The persist middleware writes are debounced through StoreStorage, so
      // navigating away can race the flush. Delete the persisted entry
      // directly to guarantee the next user starts with a clean slate.
      await platform.delStoreValue('plugin-store')
    } catch (err) {
      console.warn('[treehouse-auth] failed to clear plugin store on signout:', err)
    }

    await clearAuthToken()
    window.location.href = '/auth'
  }, [])
}
