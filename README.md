# The Treehouse

A third-party plugin system built on Chatbox, enabling interactive apps to live inside an AI chat window for K-12 students.

**Live demo:** https://thetreehouse.vercel.app

## Setup

1. Clone the repo
   ```bash
   git clone https://labs.gauntletai.com/kirstencoronado/the-treehouse.git
   cd the-treehouse
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in values
   ```bash
   cp .env.example .env.local
   ```
4. Start the dev server
   ```bash
   npm run dev:web
   ```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_PLATFORM_ORIGIN` | Origin for postMessage validation (default `http://localhost:3000`) |
| `VITE_JWT_SECRET` | Secret for signing platform auth tokens |
| `VITE_TEACHER_CODE` | Access code for teacher role |
| `VITE_PLUGIN_CHESS_URL` | Chess plugin URL (default `http://localhost:5174`) |
| `VITE_PLUGIN_PIXELART_URL` | Pixel Art plugin URL (default `http://localhost:5175`) |
| `VITE_PLUGIN_PET_URL` | Pet plugin URL (default `http://localhost:5176`) |
| `VITE_PLUGIN_TOKENS_URL` | Tokens plugin URL (default `http://localhost:5177`) |

## Plugin apps

| App | Directory | Live URL |
|---|---|---|
| PokéChess | [treehouse-chess/](treehouse-chess/) | https://pokechess.vercel.app |
| Pixel Art | [treehouse-pixelart/](treehouse-pixelart/) | https://pixelart.vercel.app |
| PET-agogy | [treehouse-pet/](treehouse-pet/) | https://pet-agogy.vercel.app |
| Token Rewards | [treehouse-tokens/](treehouse-tokens/) | https://tokenrewards.vercel.app |

## How the plugin system works

1. Plugins register via a manifest with an `iframeUrl` and `mcpServerUrl`
2. On each message, Claude receives all active plugin tool schemas dynamically
3. When Claude invokes a tool, the platform forwards it to the plugin iframe via `postMessage`
4. The plugin responds with a tool result and Claude continues
5. When the plugin fires `TREEHOUSE_COMPLETION`, the result enters conversation history

## Architecture

Three files in Chatbox are modified:

- **`src/renderer/stores/session/stream-chunk-processor.ts`** — detects plugin tool calls in AI stream chunks and dispatches `treehouse:toolCall` custom events
- **`src/renderer/packages/model-calls/stream-text.ts`** — injects plugin tool schemas before each Claude call and bridges tool execution via `pluginBridge`
- **`src/renderer/components/chat/MessageList.tsx`** — mounts the `PluginHost` iframe manager in the chat layout

Everything else is additive:

- `src/shared/types/plugin.ts` — shared TypeScript types and `postMessage` constants
- `src/renderer/stores/pluginStore.ts` — Zustand store for plugin manifests, state, and failure tracking
- `src/renderer/stores/pluginBridge.ts` — promise-based bridge between AI SDK tool execution and iframe responses
- `src/renderer/stores/pluginRegistry.ts` — default plugin manifests and MCP schema refresh
- `src/renderer/components/plugins/PluginHost.tsx` — iframe lifecycle manager (load, ready, messaging, teardown)
- `src/renderer/lib/pluginPersistence.ts` — cross-session state persistence via Supabase
- `src/renderer/hooks/useOAuth.ts` — PKCE OAuth flow for authenticated plugins

## API documentation

See [PLUGIN_API.md](PLUGIN_API.md) for the full plugin developer reference, including manifest schema, postMessage protocol, lifecycle, and starter template.

## License

[GPLv3](./LICENSE)
