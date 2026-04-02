import type { PluginManifest, ToolSchema } from '@shared/types/plugin'
import { pluginStore } from './pluginStore'

const defaultPlugins: PluginManifest[] = [
  {
    id: 'treehouse-chess',
    name: 'Chess',
    iframeUrl: 'http://localhost:5174',
    mcpServerUrl: 'http://localhost:5174/mcp',
    tools: [
      {
        name: 'start_game',
        description: 'Start a new chess game. A visual interactive board is rendered — do NOT draw ASCII. The human plays White and moves by dragging pieces on the board. You play Black. After starting, WAIT for the human to make their move — do NOT call make_move until it is Black\'s turn.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'make_move',
        description: 'Make YOUR move as Black. Only call this when it is Black\'s turn. The human moves White pieces by dragging on the visual board — never call this for White moves. Uses algebraic notation (e.g. "e5", "Nf6", "O-O"). Call get_board_state first if you are unsure whose turn it is.',
        parameters: {
          type: 'object',
          properties: { move: { type: 'string', description: 'The move in algebraic notation' } },
          required: ['move'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_board_state',
        description: 'Get the current board position as a FEN string. Use this to see what moves have been made and whose turn it is. The user can see the visual board — do NOT render a text/ASCII board.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'resign',
        description: 'Resign the game on behalf of the human player.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
    sandboxPolicy: '',
    enabled: true,
  },
  {
    id: 'treehouse-pixelart',
    name: 'Pixel Art',
    iframeUrl: 'http://localhost:5175',
    mcpServerUrl: 'http://localhost:5175/mcp',
    tools: [],
    sandboxPolicy: '',
    enabled: false,
  },
  {
    id: 'treehouse-pet',
    name: 'PET-agogy',
    iframeUrl: 'http://localhost:5176',
    mcpServerUrl: 'http://localhost:5176/mcp',
    tools: [],
    sandboxPolicy: '',
    enabled: false,
  },
]

export function seedDefaultPlugins() {
  const { manifests, registerPlugin } = pluginStore.getState()
  const existingIds = new Set(manifests.map((m) => m.id))

  for (const plugin of defaultPlugins) {
    if (!existingIds.has(plugin.id)) {
      registerPlugin(plugin)
    } else {
      // Always sync default plugins with latest manifest (tools, sandboxPolicy, etc.)
      registerPlugin(plugin)
    }
    // Clear degraded state for default plugins on startup
    pluginStore.setState((state) => {
      delete state.degraded[plugin.id]
      state.failureCounts[plugin.id] = 0
    })
  }
}

// TREEHOUSE: fetch tool schemas from each plugin's MCP server
export async function refreshPluginSchemas() {
  const { manifests, degraded } = pluginStore.getState()
  // Skip plugins that already have tools defined in their manifest
  const enabled = manifests.filter((m) => m.enabled && !degraded[m.id] && m.tools.length === 0)

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
