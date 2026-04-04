import { jwtVerify } from 'jose'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import platform from '@/platform'

const AUTH_TOKEN_KEY = 'treehouse_auth_token'

interface AuthUser {
  email: string
  userId: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

function getSecret(): Uint8Array {
  // @ts-ignore - import.meta.env is a Vite feature
  const secret = (import.meta.env?.VITE_JWT_SECRET as string) || 'treehouse-dev-secret-replace-in-production'
  return new TextEncoder().encode(secret)
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
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.email && typeof payload.email === 'string' && payload.sub) {
      return { email: payload.email, userId: payload.sub }
    }
    return null
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
