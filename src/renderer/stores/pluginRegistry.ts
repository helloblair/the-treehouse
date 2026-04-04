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
    tools: [
      {
        name: 'start_canvas',
        description:
          'Open a blank pixel art canvas for the user to draw on. A visual interactive grid appears — the user draws by clicking cells. Optional param "size" can be 16 (default) or 32 for a larger canvas.',
        parameters: {
          type: 'object',
          properties: {
            size: {
              type: 'number',
              description: 'Grid size: 16 (default) or 32',
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'get_canvas_state',
        description:
          'Capture the current pixel art canvas as a base64 PNG image. Returns { imageBase64, width, height }. Use this when the user asks you to look at, describe, or critique their drawing.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'clear_canvas',
        description: 'Reset all cells on the pixel art canvas to white.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'set_palette',
        description:
          'Replace the color palette row in the pixel art canvas with custom hex color values. Use this when the user asks for a themed palette (e.g. sunset, ocean, retro).',
        parameters: {
          type: 'object',
          properties: {
            colors: {
              type: 'string',
              description:
                'JSON array of hex color strings, e.g. ["#ff6b35","#f7c59f","#efefd0","#004e89","#1a659e"]',
            },
          },
          required: ['colors'],
          additionalProperties: false,
        },
      },
    ],
    sandboxPolicy: '',
    enabled: true,
  },
  {
    id: 'treehouse-pet',
    name: 'PET-agogy',
    iframeUrl: 'http://localhost:5176',
    mcpServerUrl: 'http://localhost:5176/mcp',
    tools: [
      {
        name: 'get_pet_state',
        description:
          "Get the student's pet current state including name, type, mood, hunger, happiness, health, and growth stage. Use this to check on the pet or reference it by name in conversation.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'complete_task',
        description:
          'Award XP to the pet for the student completing a learning task (+20 XP, +10 happiness). Only call this when the pet plugin is currently active and the student tells their pet about finishing work. Do NOT call this alongside award_tokens — let the student decide which plugin to visit. The pet evolves at 100 XP (junior) and 300 XP (adult). Returns whether the pet evolved.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'play_with_pet',
        description:
          'Play with the pet to boost happiness (+30). The pet does an ecstatic animation for 3 seconds. Use when the student asks to play with or interact with their pet.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'check_pet_health',
        description:
          "Check the pet's health and get a plain English summary of how it's doing. Returns all stats plus a human-readable summary.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'bathe_pet',
        description:
          'Give the pet a bath (+15 happiness, +5 health, resets stinky timer). Use when the student asks to bathe or clean their pet, or when the pet is stinky.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'pet_the_pet',
        description:
          'Pet/cuddle the pet for a small happiness and health boost (+10 happiness, +3 health). Use when the student wants to show affection to their pet.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
    sandboxPolicy: '',
    enabled: true,
  },
  {
    id: 'treehouse-tokens',
    name: 'Token Rewards',
    iframeUrl: 'http://localhost:5177',
    mcpServerUrl: 'http://localhost:5177/mcp',
    tools: [
      // ── Student tools ──
      {
        name: 'get_wallet',
        description:
          "Get the student's current token balance, lifetime earnings, and list of redeemed rewards.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_my_assignments',
        description:
          "List the student's active assignments and their submission status (not started, pending, approved, rejected). Use this to help the student see what work they have.",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'submit_assignment',
        description:
          'Submit an assignment for teacher review. The student must provide the assignment_id. If rejected previously, this resubmits it. Do NOT try to award tokens — only teachers can approve work.',
        parameters: {
          type: 'object',
          properties: {
            assignment_id: { type: 'string', description: 'The UUID of the assignment to submit' },
            student_notes: { type: 'string', description: 'Optional notes from the student about their work' },
          },
          required: ['assignment_id'],
          additionalProperties: false,
        },
      },
      {
        name: 'redeem_reward',
        description:
          'Redeem a reward from the catalog using the student\'s tokens. Use get_rewards_catalog first to see available rewards and their IDs.',
        parameters: {
          type: 'object',
          properties: {
            reward_id: { type: 'string', description: 'The ID of the reward to redeem' },
          },
          required: ['reward_id'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_transactions',
        description: "Get the student's recent token transaction history (earns and redemptions).",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_rewards_catalog',
        description:
          'Get the full list of available rewards with their IDs, names, costs, and descriptions.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      // ── Teacher tools ──
      {
        name: 'create_assignment',
        description:
          'Create a new assignment for students. Only works for teachers. Requires title, subject, and token_value. Optional: description, due_date (ISO string).',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Assignment title' },
            description: { type: 'string', description: 'Detailed assignment description' },
            subject: { type: 'string', description: 'School subject (math, reading, science, writing, art, social studies)' },
            token_value: { type: 'number', description: 'Tokens awarded on approval (1-100)' },
            due_date: { type: 'string', description: 'Optional due date as ISO string' },
          },
          required: ['title', 'subject', 'token_value'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_pending_submissions',
        description:
          'Get all student submissions awaiting teacher review. Only works for teachers. Returns student name, assignment title, notes, and submission time.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'approve_submission',
        description:
          'Approve a student submission. Tokens are awarded automatically. Only works for teachers. Requires submission_id.',
        parameters: {
          type: 'object',
          properties: {
            submission_id: { type: 'string', description: 'The UUID of the submission to approve' },
            teacher_notes: { type: 'string', description: 'Optional feedback for the student' },
          },
          required: ['submission_id'],
          additionalProperties: false,
        },
      },
      {
        name: 'reject_submission',
        description:
          'Reject a student submission with feedback so they can retry. Only works for teachers.',
        parameters: {
          type: 'object',
          properties: {
            submission_id: { type: 'string', description: 'The UUID of the submission to reject' },
            teacher_notes: { type: 'string', description: 'Feedback explaining why it was rejected and what to improve' },
          },
          required: ['submission_id'],
          additionalProperties: false,
        },
      },
    ],
    sandboxPolicy: '',
    enabled: true,
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
