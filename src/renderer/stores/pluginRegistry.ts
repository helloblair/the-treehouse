import type { PluginManifest, ToolSchema } from '@shared/types/plugin'
import { pluginStore } from './pluginStore'

const defaultPlugins: PluginManifest[] = [
  {
    id: 'treehouse-chess',
    name: 'Chess',
    iframeUrl: 'http://localhost:5174',
    mcpServerUrl: 'http://localhost:5174/mcp',
    tools: [],
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-pixelart',
    name: 'Pixel Art',
    iframeUrl: 'http://localhost:5175',
    mcpServerUrl: 'http://localhost:5175/mcp',
    tools: [],
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-pet',
    name: 'PET-agogy',
    iframeUrl: 'http://localhost:5176',
    mcpServerUrl: 'http://localhost:5176/mcp',
    tools: [],
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
]

export function seedDefaultPlugins() {
  const { manifests, registerPlugin } = pluginStore.getState()
  const existingIds = new Set(manifests.map((m) => m.id))

  for (const plugin of defaultPlugins) {
    if (!existingIds.has(plugin.id)) {
      registerPlugin(plugin)
    }
  }
}

// TREEHOUSE: fetch tool schemas from each plugin's MCP server
export async function refreshPluginSchemas() {
  const { manifests, degraded } = pluginStore.getState()
  const enabled = manifests.filter((m) => m.enabled && !degraded[m.id])

  const results = await Promise.allSettled(
    enabled.map(async (manifest) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const res = await fetch(`${manifest.mcpServerUrl}/tools`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { tools: ToolSchema[] }
        pluginStore.getState().registerPlugin({ ...manifest, tools: data.tools })
      } catch (err) {
        console.warn(`[Treehouse] Failed to fetch tools for plugin "${manifest.id}":`, err)
        pluginStore.getState().markDegraded(manifest.id)
      } finally {
        clearTimeout(timeout)
      }
    })
  )

  return results
}

// TREEHOUSE: expose pluginStore on window for dev/testing
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__pluginStore = pluginStore
}

// Re-fetch schemas when the set of enabled plugins changes (e.g. a new plugin is registered)
let _prevEnabledIds = ''
pluginStore.subscribe(
  (state) => state.manifests,
  (manifests) => {
    const enabledIds = manifests
      .filter((m) => m.enabled)
      .map((m) => m.id)
      .sort()
      .join(',')
    if (enabledIds !== _prevEnabledIds) {
      _prevEnabledIds = enabledIds
      void refreshPluginSchemas()
    }
  }
)
