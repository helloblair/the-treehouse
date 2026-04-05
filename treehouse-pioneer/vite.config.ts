import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const tools = [
  {
    name: 'start_journey',
    description: 'Begins a new Pioneer Path game. Player names their party of 5.',
    parameters: {
      type: 'object',
      properties: {
        party_names: { type: 'array', items: { type: 'string' }, description: 'Names of 5 party members' },
        starting_money: { type: 'number', description: 'Starting funds in dollars (100-1600)' },
      },
      required: ['party_names'],
    },
  },
  {
    name: 'get_journey_state',
    description: 'Returns current game state including day, miles, supplies, party health, active events, and availableActions. IMPORTANT: Only narrate facts from the returned data. Do not invent outcomes. Use availableActions to know which options to present to the player.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'make_decision',
    description: 'Player makes a trail decision: set pace, set rations, rest, continue, hunt, or trade at fort. Hunt auto-simulates and returns actual results (food gained, ammo used) — narrate ONLY what the result says. For river crossings, use cross_river instead.',
    parameters: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          enum: ['set_pace_steady', 'set_pace_strenuous', 'set_pace_grueling', 'set_rations_filling', 'set_rations_meager', 'set_rations_bare_bones', 'rest', 'continue', 'hunt', 'trade'],
          description: 'The decision to make',
        },
        trade_item: { type: 'string', description: 'Item to buy if decision is trade (food, clothing, ammunition, medicine, oxen)' },
        trade_quantity: { type: 'number', description: 'Quantity to buy' },
      },
      required: ['decision'],
    },
  },
  {
    name: 'resolve_event',
    description: 'Player resolves an active random event with a choice.',
    parameters: {
      type: 'object',
      properties: {
        choice_index: { type: 'number', description: 'Index of the chosen option from the event choices array' },
      },
      required: ['choice_index'],
    },
  },
  {
    name: 'advance_days',
    description: 'Advance the journey by the specified number of days, applying daily supply consumption, weather, and random events.',
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
    description: 'Choose a method to cross a river when phase is "river". Ford is free but risky (risk scales with depth). Caulk & float is free with moderate risk. Ferry costs $5 but is safe. The game state includes riverDepth so you can advise the player.',
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
]

function mcpServerPlugin(): Plugin {
  return {
    name: 'pioneer-mcp-server',
    configureServer(server) {
      server.middlewares.use('/mcp/tools', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ tools }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mcpServerPlugin()],
  server: {
    port: 5178,
  },
})
