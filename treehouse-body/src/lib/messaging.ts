import type { TreehouseToolCall } from '../types'

const PLUGIN_ID = 'treehouse-body'
const PLATFORM_ORIGIN = import.meta.env.VITE_PLATFORM_ORIGIN || '*'

type ToolHandler = (
  toolName: string,
  params: Record<string, unknown>,
) => unknown | Promise<unknown>

let toolHandler: ToolHandler | null = null

function onMessage(event: MessageEvent) {
  if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
  const data = event.data as TreehouseToolCall | undefined
  if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
    const { callId, toolName, params } = data.payload
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
}

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

export function initMessaging(handler: ToolHandler) {
  toolHandler = handler
  window.addEventListener('message', onMessage)
  sendReady()
  return () => {
    window.removeEventListener('message', onMessage)
    toolHandler = null
  }
}
