// TREEHOUSE: Bridge between plugin tool execute() functions and iframe postMessage responses.
// When a plugin tool's execute() is called by the AI SDK, it registers a pending promise here.
// PluginHost resolves that promise when it receives TREEHOUSE_TOOL_RESULT from the iframe.

type PendingCall = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

const pendingToolCalls = new Map<string, PendingCall>()
const readyResolvers = new Map<string, Array<() => void>>()
const readyPlugins = new Set<string>()

/**
 * Register a tool call and return a promise that resolves when the iframe responds.
 */
export function registerToolCall(callId: string, timeoutMs = 30_000): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    pendingToolCalls.set(callId, { resolve, reject })

    const timer = setTimeout(() => {
      if (pendingToolCalls.has(callId)) {
        pendingToolCalls.delete(callId)
        reject(new Error('Plugin tool call timed out after 30 seconds'))
      }
    }, timeoutMs)

    // Wrap resolve/reject to clear the timer
    const original = pendingToolCalls.get(callId)!
    pendingToolCalls.set(callId, {
      resolve: (result) => {
        clearTimeout(timer)
        original.resolve(result)
      },
      reject: (error) => {
        clearTimeout(timer)
        original.reject(error)
      },
    })
  })
}

/**
 * Resolve a pending tool call with the result from the iframe.
 */
export function resolveToolCall(callId: string, result: unknown, isError: boolean) {
  const pending = pendingToolCalls.get(callId)
  if (!pending) return
  pendingToolCalls.delete(callId)
  if (isError) {
    pending.reject(new Error(typeof result === 'string' ? result : JSON.stringify(result)))
  } else {
    pending.resolve(result)
  }
}

/**
 * Wait for a plugin iframe to signal TREEHOUSE_READY.
 * Resolves immediately if the plugin is already ready.
 */
export function waitForPluginReady(pluginId: string): Promise<void> {
  if (readyPlugins.has(pluginId)) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const list = readyResolvers.get(pluginId) || []
    list.push(resolve)
    readyResolvers.set(pluginId, list)
  })
}

/**
 * Called by PluginHost when TREEHOUSE_READY is received from an iframe.
 */
export function markPluginReady(pluginId: string) {
  readyPlugins.add(pluginId)
  const list = readyResolvers.get(pluginId)
  if (list) {
    for (const resolve of list) resolve()
    readyResolvers.delete(pluginId)
  }
}

/**
 * Called by PluginHost when the iframe is dismissed/unmounted.
 */
export function clearPluginReady(pluginId: string) {
  readyPlugins.delete(pluginId)
}

/**
 * Check if there's a pending tool call for a given callId.
 */
export function hasPendingCall(callId: string): boolean {
  return pendingToolCalls.has(callId)
}
