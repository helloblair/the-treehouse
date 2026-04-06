import type { PluginManifest, ToolSchema } from '@shared/types/plugin'
import { pluginStore } from './pluginStore'

// Plugin URLs: use env vars in production, fall back to localhost dev servers
const PLUGIN_URLS: Record<string, { iframe: string; mcp: string }> = {
  'treehouse-chess': {
    iframe: import.meta.env.VITE_PLUGIN_CHESS_URL || 'http://localhost:5174',
    mcp: (import.meta.env.VITE_PLUGIN_CHESS_URL || 'http://localhost:5174') + '/mcp',
  },
  'treehouse-pixelart': {
    iframe: import.meta.env.VITE_PLUGIN_PIXELART_URL || 'http://localhost:5175',
    mcp: (import.meta.env.VITE_PLUGIN_PIXELART_URL || 'http://localhost:5175') + '/mcp',
  },
  'treehouse-pet': {
    iframe: import.meta.env.VITE_PLUGIN_PET_URL || 'http://localhost:5176',
    mcp: (import.meta.env.VITE_PLUGIN_PET_URL || 'http://localhost:5176') + '/mcp',
  },
  'treehouse-tokens': {
    iframe: import.meta.env.VITE_PLUGIN_TOKENS_URL || 'http://localhost:5177',
    mcp: (import.meta.env.VITE_PLUGIN_TOKENS_URL || 'http://localhost:5177') + '/mcp',
  },
  'treehouse-pioneer': {
    iframe: import.meta.env.VITE_PLUGIN_PIONEER_URL || 'http://localhost:5178',
    mcp: (import.meta.env.VITE_PLUGIN_PIONEER_URL || 'http://localhost:5178') + '/mcp',
  },
  'treehouse-body': {
    iframe: import.meta.env.VITE_PLUGIN_BODY_URL || 'http://localhost:5179',
    mcp: (import.meta.env.VITE_PLUGIN_BODY_URL || 'http://localhost:5179') + '/mcp',
  },
}

const defaultPlugins: PluginManifest[] = [
  {
    id: 'treehouse-chess',
    name: 'PokéChess',
    iframeUrl: PLUGIN_URLS['treehouse-chess'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-chess'].mcp,
    tools: [
      {
        name: 'start_game',
        description: 'Start a new chess game. A visual interactive board is rendered — do NOT draw ASCII. The human plays White and moves by dragging pieces on the board. You play Black. After starting, WAIT for the human to make their move — do NOT call make_move until it is Black\'s turn.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'make_move',
        description: 'Make YOUR move as Black. Only call this when it is Black\'s turn. Uses algebraic notation (e.g. "e5", "Nf6", "O-O"). CRITICAL RULES: (1) Call get_board_state BEFORE every make_move. (2) Do NOT write any narration or text about your move BEFORE calling this tool — the move may be illegal. (3) Only narrate AFTER this tool returns success. (4) If this returns an error, try a different move — do NOT narrate the failed move.',
        parameters: {
          type: 'object',
          properties: { move: { type: 'string', description: 'The move in algebraic notation' } },
          required: ['move'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_board_state',
        description: 'Get the current board position and full move history. Returns FEN, whose turn it is, all moves played so far, and check status. You MUST call this before every make_move. The user can see the visual board — do NOT render a text/ASCII board.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'resign',
        description: 'Resign the game on behalf of the human player.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-pixelart',
    name: 'Pixel Art',
    iframeUrl: PLUGIN_URLS['treehouse-pixelart'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-pixelart'].mcp,
    tools: [
      {
        name: 'start_canvas',
        description:
          'Open a pixel art canvas for the user to draw on. A visual interactive grid appears — the user draws by clicking cells. If the user already has a drawing and the size is unchanged, it restores the existing drawing unless "reset" is true. Optional param "size" can be 16 (default) or 32 for a larger canvas.',
        parameters: {
          type: 'object',
          properties: {
            size: {
              type: 'number',
              description: 'Grid size: 16 (default) or 32',
            },
            reset: {
              type: 'boolean',
              description: 'If true, clears any existing drawing and starts fresh even if the size is the same',
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'get_canvas_state',
        description:
          'Capture the current pixel art canvas. Returns { imageBase64, textGrid, legend, width, height }. imageBase64 is a PNG screenshot. textGrid is a character-based representation of the grid using color symbols (. for white/empty, # for black, R red, O orange, etc.) and legend maps each symbol to its hex color. Use this when the user asks you to look at, describe, or critique their drawing.',
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
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-pet',
    name: 'PET-agogy',
    iframeUrl: PLUGIN_URLS['treehouse-pet'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-pet'].mcp,
    tools: [
      {
        name: 'get_pet_state',
        description:
          "Get the student's pet current state including name, type, mood, hunger, happiness, health, growth stage, and xp. Use this to check on the pet or reference it by name in conversation. XP thresholds: 100 (junior), 300 (adult), 500 (max).",
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'complete_task',
        description:
          'Award XP to the pet for the student completing a learning task (+20 XP, +10 happiness). Only call this when the pet plugin is currently active and the student tells their pet about finishing work. Do NOT call this alongside award_tokens — let the student decide which plugin to visit. The pet evolves at 100 XP (junior) and 300 XP (adult). Returns whether the pet evolved.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'feed_pet',
        description:
          'Feed the pet to restore hunger (+25) and boost health (+10). Resets the fed timer. Use when the student asks to feed their pet or when the pet is hungry.',
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
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-tokens',
    name: 'Token Rewards',
    iframeUrl: PLUGIN_URLS['treehouse-tokens'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-tokens'].mcp,
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
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-body',
    name: 'Anatomy Adventure',
    iframeUrl: PLUGIN_URLS['treehouse-body'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-body'].mcp,
    tools: [
      {
        name: 'get_progress',
        description:
          'Get the student\'s Anatomy Adventure progress: XP, streaks, explored parts, quiz results, and per-system completion. Use this to check how far along they are or to praise their progress.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_systems',
        description:
          'List all available body systems in Anatomy Adventure with their names, part counts, and descriptions.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_part_info',
        description:
          'Get educational info and quiz data for a specific body part. Returns the part\'s info text, quiz question, correct answer, and answer options. Call this when the student clicks a body part so you can teach them about it and then quiz them in chat. IMPORTANT: Do NOT reveal the correct answer when asking the question -- present the options and wait for the student to answer.',
        parameters: {
          type: 'object',
          properties: {
            system_id: { type: 'string', description: 'The body system ID (e.g. "muscular", "skeletal", "circulatory", "respiratory", "digestive", "nervous")' },
            part_id: { type: 'string', description: 'The body part ID (e.g. "heart", "femur", "brain")' },
          },
          required: ['part_id'],
          additionalProperties: false,
        },
      },
      {
        name: 'record_quiz_answer',
        description:
          'Record the result of a quiz answered in chat. Call this after the student answers a quiz question to update their XP, streak, and badges. The correct answer comes from get_part_info -- compare the student\'s chat response to decide if correct.',
        parameters: {
          type: 'object',
          properties: {
            system_id: { type: 'string', description: 'The body system ID' },
            part_id: { type: 'string', description: 'The body part ID that was quizzed' },
            correct: { type: 'boolean', description: 'Whether the student answered correctly' },
          },
          required: ['part_id', 'correct'],
          additionalProperties: false,
        },
      },
      {
        name: 'start_quiz',
        description:
          'Prompt the student to click a body part in the diagram to start exploring and quizzing. Use when the student wants to study but hasn\'t clicked anything yet.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
    sandboxPolicy: 'allow-scripts allow-same-origin',
    enabled: true,
  },
  {
    id: 'treehouse-pioneer',
    name: 'Pioneer Path',
    iframeUrl: PLUGIN_URLS['treehouse-pioneer'].iframe,
    mcpServerUrl: PLUGIN_URLS['treehouse-pioneer'].mcp,
    tools: [
      {
        name: 'start_journey',
        description:
          'Begins a new Pioneer Path game. Player names their party of 5 pioneers and sets starting funds. A pixel art trail map appears with the wagon at Frontier Town. After calling this, narrate the departure and then STOP — present the player with their options (set pace, set rations, continue onto the trail, rest, or hunt) and WAIT for them to decide. Trading is only available at forts further along the trail.',
        parameters: {
          type: 'object',
          properties: {
            party_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Names of 5 party members',
            },
            starting_money: {
              type: 'number',
              description: 'Starting funds in dollars (100-1600, default 800)',
            },
          },
          required: ['party_names'],
        },
      },
      {
        name: 'get_journey_state',
        description:
          'Returns current game state: day, miles, supplies, party health, weather, active events, availableActions, and the last 5 log entries. IMPORTANT: Only narrate facts from the returned data — never invent outcomes or skip ahead. Use the availableActions array to know exactly which options to present to the player. The log entries show recent events (deaths, weather changes, arrivals) — weave them into your narration. Narrate as a frontier journal entry, referencing party members by name.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'make_decision',
        description:
          'Execute a trail decision the PLAYER has explicitly requested: set pace, set rations, rest, continue, hunt, or trade at a fort. Hunting transitions the game to an interactive hunt mini-game in the UI — the player clicks animals on a canvas to shoot them. The hunt results (food gained, ammo used) come back via state update when the mini-game finishes. After calling hunt, tell the player the hunt is starting and STOP — wait for the results. For river crossings use cross_river instead. Only call this when the player has told you what they want to do. NEVER call this on your own.',
        parameters: {
          type: 'object',
          properties: {
            decision: {
              type: 'string',
              enum: [
                'set_pace_steady',
                'set_pace_strenuous',
                'set_pace_grueling',
                'set_rations_filling',
                'set_rations_meager',
                'set_rations_bare_bones',
                'rest',
                'continue',
                'hunt',
                'trade',
              ],
              description: 'The decision to make',
            },
            trade_item: {
              type: 'string',
              description: 'Item to buy if decision is trade (food, clothing, ammunition, medicine, oxen)',
            },
            trade_quantity: { type: 'number', description: 'Quantity to buy' },
          },
          required: ['decision'],
        },
      },
      {
        name: 'resolve_event',
        description:
          'Resolve an active random trail event. Only call when the player has chosen which option to take. Narrate the consequence dramatically, then STOP and wait for the player\'s next decision.',
        parameters: {
          type: 'object',
          properties: {
            choice_index: {
              type: 'number',
              description: 'Index of the chosen option from the event choices array',
            },
          },
          required: ['choice_index'],
        },
      },
      {
        name: 'advance_days',
        description:
          'Advance the journey by 1-7 days. Only call when the player says to continue, move on, or travel. Applies daily food consumption, weather changes, travel miles, health effects, and may trigger random events. After calling, narrate what happened based on the returned data and STOP — present the availableActions to the player.',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Number of days to advance (1-7)' },
          },
          required: ['days'],
        },
      },
      {
        name: 'cross_river',
        description:
          'Cross a river when the game phase is "river". Only available at river crossings. The state includes riverDepth — use it to advise the player on risk. Ford is free but risky (risk scales with depth). Caulk & float is free with moderate risk. Ferry costs $5 but is safe. Narrate the result based on the returned data. NEVER call this unless the player has chosen a crossing method.',
        parameters: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['ford', 'caulk', 'ferry'],
              description: 'Crossing method: ford (free, risky), caulk (free, moderate risk), ferry ($5, safe)',
            },
          },
          required: ['method'],
        },
      },
    ],
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
