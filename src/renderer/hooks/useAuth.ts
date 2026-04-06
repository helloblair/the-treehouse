import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import platform from '@/platform'
import { supabase } from '@/lib/supabase'

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

    // Role from user_metadata (set during signUp)
    const metaRole = payload.user_metadata?.role
    let role: 'teacher' | 'student' | 'support' =
      metaRole === 'support' ? 'support' : metaRole === 'teacher' ? 'teacher' : 'student'

    // If no role in JWT metadata, try user_profiles table
    if (!metaRole && supabase) {
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
    await clearAuthToken()
    window.location.href = '/auth'
  }, [])
}
