import { useCallback, useEffect, useState } from 'react'
import { pluginStore } from '@/stores/pluginStore'
import type { OAuthToken } from '@shared/types/plugin'

interface OAuthState {
  isOAuthActive: boolean
  isOAuthExpired: boolean
  isLoading: boolean
  error: string | null
}

export function useOAuth(providerId: string | undefined) {
  const [state, setState] = useState<OAuthState>({
    isOAuthActive: false,
    isOAuthExpired: false,
    isLoading: false,
    error: null,
  })

  // Check if we have a stored token for this provider
  useEffect(() => {
    if (!providerId) return
    const tokens = pluginStore.getState().oauthTokens
    const token = tokens[providerId]
    if (token) {
      const isExpired = Date.now() > token.expiresAt
      setState(s => ({ ...s, isOAuthActive: !isExpired, isOAuthExpired: isExpired }))
    }
  }, [providerId])

  const login = useCallback(async () => {
    if (!providerId) return
    const manifests = pluginStore.getState().manifests
    const manifest = manifests.find(m => m.id === providerId)
    if (!manifest?.authConfig) return

    setState(s => ({ ...s, isLoading: true, error: null }))

    try {
      // Generate PKCE code verifier and challenge
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      const { authorizationUrl, clientId, scopes } = manifest.authConfig
      const redirectUri = `${window.location.origin}/oauth/callback`

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: providerId,
      })

      const authUrl = `${authorizationUrl}?${params.toString()}`

      // Open popup for OAuth consent
      const popup = window.open(authUrl, 'treehouse-oauth', 'width=500,height=700')
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      // Listen for the callback message from the popup
      const token = await new Promise<OAuthToken>((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler)
          reject(new Error('OAuth timed out after 5 minutes'))
        }, 5 * 60 * 1000)

        const handler = async (event: MessageEvent) => {
          if (event.data?.type !== 'TREEHOUSE_AUTH_TOKEN') return
          if (event.data?.pluginId !== providerId) return

          clearTimeout(timeout)
          window.removeEventListener('message', handler)

          const { code } = event.data
          if (!code) {
            reject(new Error('No authorization code received'))
            return
          }

          // Exchange code for token
          try {
            const tokenRes = await fetch(manifest.authConfig!.tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                code_verifier: verifier,
              }),
            })
            const tokenData = await tokenRes.json()
            if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed')

            resolve({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
            })
          } catch (err) {
            reject(err)
          }
        }
        window.addEventListener('message', handler)
      })

      pluginStore.getState().storeOAuthToken(providerId, token)
      setState({ isOAuthActive: true, isOAuthExpired: false, isLoading: false, error: null })

    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed'
      setState(s => ({ ...s, isLoading: false, error: message }))
    }
  }, [providerId])

  const logout = useCallback(async () => {
    if (!providerId) return
    pluginStore.getState().storeOAuthToken(providerId, {
      access_token: '',
      expiresAt: 0,
    })
    setState({ isOAuthActive: false, isOAuthExpired: false, isLoading: false, error: null })
  }, [providerId])

  const refresh = useCallback(async () => {
    if (!providerId) return
    const tokens = pluginStore.getState().oauthTokens
    const token = tokens[providerId]
    if (!token?.refresh_token) { await logout(); return }

    const manifests = pluginStore.getState().manifests
    const manifest = manifests.find(m => m.id === providerId)
    if (!manifest?.authConfig) return

    try {
      const res = await fetch(manifest.authConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          client_id: manifest.authConfig.clientId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { await logout(); return }

      pluginStore.getState().storeOAuthToken(providerId, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || token.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      })
      setState({ isOAuthActive: true, isOAuthExpired: false, isLoading: false, error: null })
    } catch {
      await logout()
    }
  }, [providerId, logout])

  return { ...state, login, logout, refresh }
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
