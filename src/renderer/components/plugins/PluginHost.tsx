import { useCallback, useEffect, useRef, useState } from 'react'
import { createMessage } from '@shared/types'
import { validateOrigin } from '@shared/types/plugin'
import { getDefaultStore } from 'jotai'
import { currentSessionIdAtom } from '@/stores/atoms'
import { useAuth } from '@/hooks/useAuth'
import { clearPluginReady, markPluginReady, resolveToolCall } from '@/stores/pluginBridge'
import { pluginStore, usePluginStore } from '@/stores/pluginStore'
import { submitNewUserMessage } from '@/stores/sessionActions'
import { loadPluginState, savePluginState } from '@/lib/pluginPersistence'

export default function PluginHost() {
  const activePluginId = usePluginStore((s) => s.activePluginId)
  const manifests = usePluginStore((s) => s.manifests)
  const manifest = manifests.find((m) => m.id === activePluginId)
  const { user } = useAuth()

  if (!manifest) return null

  return <PluginIframe key={manifest.id} manifest={manifest} userId={user?.userId} role={user?.role} />
}

// Plugins that manage their own Supabase persistence (pet, tokens) don't need parent-side persistence.
const SELF_PERSISTED_PLUGINS = new Set(['treehouse-pet', 'treehouse-tokens', 'treehouse-pioneer'])

function PluginIframe({ manifest, userId, role }: { manifest: (typeof pluginStore extends { getState: () => infer S } ? S : never)['manifests'][number]; userId?: string; role?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // 10-second load timeout
  useEffect(() => {
    loadTimerRef.current = setTimeout(() => {
      if (!ready) {
        console.warn(`[Treehouse] Plugin "${manifest.id}" failed to load within 10 seconds`)
        pluginStore.getState().dismissPlugin()
        pluginStore.getState().incrementFailure(manifest.id)
        // Send recovery message to chat
        const sessionId = getDefaultStore().get(currentSessionIdAtom)
        if (sessionId) {
          const msg = createMessage(
            'user',
            `The ${manifest.name} app couldn't load right now. You can try again by asking me to open it, or we can keep going.`,
          )
          void submitNewUserMessage(sessionId, { newUserMsg: msg, needGenerating: true })
        }
      }
    }, 10_000)

    return () => {
      clearTimeout(loadTimerRef.current)
    }
  }, [manifest.id, manifest.name, ready])

  // Clear ready state only on unmount
  useEffect(() => {
    return () => clearPluginReady(manifest.id)
  }, [manifest.id])

  // Listen for postMessage from iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!validateOrigin(event, manifest)) return

      const data = event.data
      if (!data?.type || data.pluginId !== manifest.id) return

      switch (data.type) {
        case 'TREEHOUSE_READY': {
          setReady(true)
          setLoading(false)
          clearTimeout(loadTimerRef.current)
          markPluginReady(manifest.id)

          // Restore state: prefer in-memory cache, then Supabase for cross-session persistence
          const cached = pluginStore.getState().pluginStates[manifest.id]
          if (cached) {
            iframeRef.current?.contentWindow?.postMessage(
              {
                type: 'TREEHOUSE_RESTORE_STATE',
                pluginId: manifest.id,
                payload: { state: cached },
              },
              new URL(manifest.iframeUrl).origin,
            )
          } else if (userId && !SELF_PERSISTED_PLUGINS.has(manifest.id)) {
            // No memory cache — try loading from Supabase (cross-session restore)
            void loadPluginState(userId, manifest.id).then((persisted) => {
              if (!persisted) return
              // If a STATE_UPDATE arrived while we were loading, the in-memory cache
              // is now newer than what Supabase returned — don't clobber it.
              if (pluginStore.getState().pluginStates[manifest.id]) return
              pluginStore.getState().cachePluginState(manifest.id, persisted)
              iframeRef.current?.contentWindow?.postMessage(
                {
                  type: 'TREEHOUSE_RESTORE_STATE',
                  pluginId: manifest.id,
                  payload: { state: persisted },
                },
                new URL(manifest.iframeUrl).origin,
              )
            })
          }
          break
        }
        case 'TREEHOUSE_TOOL_RESULT': {
          const { callId, result, isError } = data.payload
          resolveToolCall(callId, result, isError ?? false)
          break
        }
        case 'TREEHOUSE_COMPLETION': {
          const sessionId = getDefaultStore().get(currentSessionIdAtom)
          if (sessionId) {
            const msg = createMessage('user', 'I finished my drawing! What do you think?')
            void submitNewUserMessage(sessionId, { newUserMsg: msg, needGenerating: true })
          }
          break
        }
        case 'TREEHOUSE_ERROR': {
          const errorMsg = data.payload?.message || data.payload?.error || 'Unknown plugin error'
          if (data.payload?.fatal) {
            console.error(`[Treehouse] Fatal error from "${manifest.id}":`, errorMsg)
            pluginStore.getState().dismissPlugin()
            pluginStore.getState().incrementFailure(manifest.id)
            // Send recovery message to chat
            const sessionId = getDefaultStore().get(currentSessionIdAtom)
            if (sessionId) {
              const msg = createMessage(
                'user',
                `The ${manifest.name} app ran into an error and had to close. You can try again by asking me to open it, or we can keep going.`,
              )
              void submitNewUserMessage(sessionId, { newUserMsg: msg, needGenerating: true })
            }
          } else {
            console.warn(`[Treehouse] Non-fatal error from "${manifest.id}":`, errorMsg)
          }
          break
        }
        case 'TREEHOUSE_STATE_UPDATE': {
          pluginStore.getState().cachePluginState(manifest.id, data.payload?.state)
          // Persist to Supabase for cross-session restore (debounced)
          if (userId && !SELF_PERSISTED_PLUGINS.has(manifest.id) && data.payload?.state) {
            savePluginState(userId, manifest.id, data.payload.state)
          }
          // If the plugin sent a userMessage (e.g. confirm move), auto-submit it
          if (data.payload?.userMessage) {
            const sessionId = getDefaultStore().get(currentSessionIdAtom)
            if (sessionId) {
              const msg = createMessage('user', data.payload.userMessage)
              void submitNewUserMessage(sessionId, { newUserMsg: msg, needGenerating: true })
            }
          }
          break
        }
      }
    },
    [manifest, userId],
  )

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  // Send init messages to plugins that need userId
  useEffect(() => {
    if (!ready || !userId) return
    const initMap: Record<string, string> = {
      'treehouse-pet': 'init_pet',
      'treehouse-tokens': 'init_tokens',
      'treehouse-pioneer': 'init_pioneer',
    }
    const toolName = initMap[manifest.id]
    if (!toolName) return
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'TREEHOUSE_TOOL_CALL',
        pluginId: manifest.id,
        payload: {
          callId: `${toolName}_${Date.now()}`,
          toolName,
          params: { userId, role: role ?? 'student' },
        },
      },
      new URL(manifest.iframeUrl).origin,
    )
  }, [manifest.id, manifest.iframeUrl, ready, userId])

  // Listen for tool call execution events from stream-text.ts execute functions
  useEffect(() => {
    function onExecuteToolCall(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail.pluginId !== manifest.id) return
      // Forward tool call to iframe
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'TREEHOUSE_TOOL_CALL',
          pluginId: manifest.id,
          payload: {
            callId: detail.callId,
            toolName: detail.toolName,
            params: detail.params,
          },
        },
        new URL(manifest.iframeUrl).origin,
      )
    }

    window.addEventListener('treehouse:executeToolCall', onExecuteToolCall)
    return () => window.removeEventListener('treehouse:executeToolCall', onExecuteToolCall)
  }, [manifest])

  return (
    <div
      style={{
        position: 'relative',
        width: 500,
        flexShrink: 0,
        overflow: 'hidden',
        borderLeft: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--mantine-color-body)',
            zIndex: 1,
          }}
        >
          <span>Loading plugin...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={manifest.iframeUrl}
        {...(manifest.sandboxPolicy ? { sandbox: manifest.sandboxPolicy } : {})}
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          display: 'block',
        }}
        title={manifest.name}
      />
    </div>
  )
}
