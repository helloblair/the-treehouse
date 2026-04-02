import { useCallback, useEffect, useRef, useState } from 'react'
import { createMessage } from '@shared/types'
import { validateOrigin } from '@shared/types/plugin'
import { getDefaultStore } from 'jotai'
import { currentSessionIdAtom } from '@/stores/atoms'
import { clearPluginReady, markPluginReady, resolveToolCall } from '@/stores/pluginBridge'
import { pluginStore, usePluginStore } from '@/stores/pluginStore'
import { submitNewUserMessage } from '@/stores/sessionActions'

export default function PluginHost() {
  const activePluginId = usePluginStore((s) => s.activePluginId)
  const manifests = usePluginStore((s) => s.manifests)
  const manifest = manifests.find((m) => m.id === activePluginId)

  if (!manifest) return null

  return <PluginIframe key={manifest.id} manifest={manifest} />
}

function PluginIframe({ manifest }: { manifest: (typeof pluginStore extends { getState: () => infer S } ? S : never)['manifests'][number] }) {
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
      }
    }, 10_000)

    return () => {
      clearTimeout(loadTimerRef.current)
    }
  }, [manifest.id, ready])

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
          break
        }
        case 'TREEHOUSE_TOOL_RESULT': {
          const { callId, result, isError } = data.payload
          resolveToolCall(callId, result, isError ?? false)
          break
        }
        case 'TREEHOUSE_COMPLETION': {
          break
        }
        case 'TREEHOUSE_ERROR': {
          if (data.payload?.fatal) {
            pluginStore.getState().dismissPlugin()
          }
          break
        }
        case 'TREEHOUSE_STATE_UPDATE': {
          pluginStore.getState().cachePluginState(manifest.id, data.payload?.state)
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
    [manifest],
  )

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

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
        width: 420,
        height: 450,
        flexShrink: 0,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-default-border)',
        marginTop: 8,
        marginBottom: 8,
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
          width: 420,
          height: 450,
          border: 'none',
          display: 'block',
        }}
        title={manifest.name}
      />
    </div>
  )
}
