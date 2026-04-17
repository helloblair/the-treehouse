# The Treehouse

A plugin-powered AI learning platform for K-12 students, built on [Chatbox](https://github.com/nicepkg/chatbox). Interactive apps live inside an AI chat window, turning conversations with Claude into hands-on activities: chess, pixel art, virtual pets, token rewards, and more.

**Live:** https://thetreehouse.vercel.app

---

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Plugin Apps](#plugin-apps)
- [User Roles](#user-roles)
- [Database](#database)
- [How the Plugin System Works](#how-the-plugin-system-works)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [License](#license)

---

## Quick Start

```bash
# Clone
git clone https://labs.gauntletai.com/kirstencoronado/the-treehouse.git
cd the-treehouse

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase and plugin URLs

# Run everything (main app + all 6 plugins)
pnpm dev:all

# Or run them separately
pnpm dev:web          # main app only
pnpm dev:plugins      # all 6 plugin dev servers
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values. Variables prefixed with `VITE_` are inlined at build time and visible to the browser. Server-only variables (like `ANTHROPIC_API_KEY`) are only available to edge/serverless functions.

### Client-side (VITE\_)

These are inlined into the browser bundle at build time. Anything sensitive must live in the server-side section instead.

| Variable | Description | Default |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | *required* |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (RLS-protected, designed to be public) | *required* |
| `VITE_PLATFORM_ORIGIN` | Origin for postMessage validation between host and plugin iframes | `http://localhost:1212` |
| `VITE_PLUGIN_CHESS_URL` | PokéChess plugin URL | `http://localhost:5174` |
| `VITE_PLUGIN_PIXELART_URL` | Pixel Art plugin URL | `http://localhost:5175` |
| `VITE_PLUGIN_PET_URL` | PET-agogy plugin URL | `http://localhost:5176` |
| `VITE_PLUGIN_TOKENS_URL` | Token Rewards plugin URL | `http://localhost:5177` |
| `VITE_PLUGIN_PIONEER_URL` | Pioneer Path plugin URL | `http://localhost:5178` |
| `VITE_PLUGIN_BODY_URL` | Anatomy Adventure plugin URL | `http://localhost:5179` |

### Server-side

Set these in **Vercel Dashboard > Environment Variables** only. They are read by edge functions in `api/` and never reach the browser bundle.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for the Claude proxy at [`api/claude.ts`](api/claude.ts) |
| `TEACHER_CODE` | Access code required to claim the teacher role. Validated server-side by [`api/claim-teacher-role.ts`](api/claim-teacher-role.ts) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. Used by the teacher-claim function to write `user_profiles.role`, which authenticated clients are not permitted to modify directly |

## Deployment

The Treehouse is deployed on **Vercel** as a static web app with two edge functions.

### Vercel configuration

[`vercel.json`](vercel.json) handles the build:

- **Build command:** `cross-env CHATBOX_BUILD_PLATFORM=web electron-vite build`
- **Output directory:** `release/app/dist/renderer`
- **Edge functions:**
  - [`api/claude.ts`](api/claude.ts) — authenticated proxy for the Anthropic API
  - [`api/claim-teacher-role.ts`](api/claim-teacher-role.ts) — verifies the teacher access code and grants the role server-side
- **Rewrites:** `/api/*` routes to edge functions; everything else falls through to `index.html` for SPA routing

### Claude API proxy

[`api/claude.ts`](api/claude.ts) is a Vercel edge function that:

1. Reads `ANTHROPIC_API_KEY` from the server environment
2. Verifies the caller's Supabase JWT (sent in the `x-treehouse-auth` header) — unauthenticated requests are rejected so anonymous traffic can't burn the platform's Anthropic credits
3. Forwards the request to `api.anthropic.com` with the key injected
4. Streams the response back to the client

On web builds, if no user-provided API key is present, the Claude provider automatically rewrites Anthropic API URLs to `/api/claude` and attaches the user's Supabase JWT — see [`src/shared/providers/definitions/models/claude.ts`](src/shared/providers/definitions/models/claude.ts). Users on the deployed site chat with Claude without needing their own key, but only after signing in.

### Required Vercel environment variables

Set these in **Vercel Dashboard > Project > Settings > Environment Variables**:

- `ANTHROPIC_API_KEY` — server-only, read by the Claude proxy at runtime
- `TEACHER_CODE` — server-only, validated by the teacher-claim edge function
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used to write privileged columns the client can't touch
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — baked into the build
- `VITE_PLUGIN_*_URL` (all 6) — plugin production URLs (see table above)

## Plugin Apps

Each plugin is a standalone Vite app deployed to its own Vercel project. They communicate with the main app via `postMessage` and expose tool schemas that Claude can invoke.

| App | Directory | Port | Live URL |
|---|---|---|---|
| PokéChess | [`treehouse-chess/`](treehouse-chess/) | 5174 | https://pokechess.vercel.app |
| Pixel Art | [`treehouse-pixelart/`](treehouse-pixelart/) | 5175 | https://pixelart.vercel.app |
| PET-agogy | [`treehouse-pet/`](treehouse-pet/) | 5176 | https://pet-agogy.vercel.app |
| Token Rewards | [`treehouse-tokens/`](treehouse-tokens/) | 5177 | https://tokenrewards.vercel.app |
| Pioneer Path | [`treehouse-pioneer/`](treehouse-pioneer/) | 5178 | https://pioneerpath.vercel.app |
| Anatomy Adventure | [`treehouse-body/`](treehouse-body/) | 5179 | https://anatomyadventure.vercel.app |

## User Roles

The Treehouse has three roles with different permissions:

### Student

- Default role on sign-up
- Can chat with Claude, use all plugins, submit assignments, earn tokens, care for their pet

### Teacher

- Requires the server-side `TEACHER_CODE` at sign-up. The code is validated by [`api/claim-teacher-role.ts`](api/claim-teacher-role.ts), which then uses the Supabase service-role key to set `user_profiles.role = 'teacher'` for that user. Direct client writes to the role column are blocked by column-level grants in [`supabase/migrations/20260407_lock_role_column.sql`](supabase/migrations/20260407_lock_role_column.sql)
- Can create assignments, approve/reject submissions, view all student data
- Approving a submission atomically awards tokens **and** +20 pet XP (with auto-evolution at 100/300 XP thresholds)

### Support / Dev

- Internal accounts seeded directly into `auth.users` with a matching `user_profiles` row whose `role = 'support'` — see [`supabase/migrations/20260406_support_role.sql`](supabase/migrations/20260406_support_role.sql)
- Support users inherit teacher-level RLS access (the `is_teacher()` helper includes support roles)

### Sign-out and shared devices

`useSignOut` clears the Supabase access token **and** wipes the persisted plugin store entry, so plugin OAuth tokens (the user's own credentials to third-party services like Spotify or GitHub) do not leak to the next user on a shared school device. See [`src/renderer/hooks/useAuth.ts`](src/renderer/hooks/useAuth.ts).

## Database

The Treehouse uses **Supabase** (Postgres) with Row-Level Security on every table. All migrations live in [`supabase/migrations/`](supabase/migrations/).

### Tables

| Table | Purpose |
|---|---|
| `user_profiles` | User identity, display name, and role (`student`, `teacher`, `support`) |
| `support_users` | Internal support/dev accounts with access codes |
| `pets` | Virtual pets — name, type, XP, growth stage, mood stats |
| `token_wallets` | Per-student token balance and lifetime earnings |
| `token_transactions` | Earn/redeem transaction ledger |
| `assignments` | Teacher-created assignments with subject, token value, due date |
| `assignment_submissions` | Student submissions with status (pending/approved/rejected) and teacher notes |
| `plugin_states` | Per-user JSONB state for any plugin |
| `pioneer_games` | Pioneer Path game state |

### Key RPC functions

| Function | Description |
|---|---|
| `approve_submission` | Approves a submission, awards tokens, and gives +20 pet XP atomically |
| `reject_submission` | Rejects a submission with teacher feedback |
| `redeem_reward` | Atomically deducts tokens and records the redemption (row-level locking prevents double-spend) |
| `submit_assignment` | Creates or resubmits a student submission |
| `create_assignment` | Teacher-only: creates a new assignment |
| `upsert_plugin_state` | Saves plugin state to Supabase per user |

### Pet growth system

Pets earn XP through two paths:

1. **Assignment approval** — when a teacher approves a submission, the student's pet automatically gets +20 XP and +10 happiness
2. **`complete_task` tool** — Claude can call this when a student mentions finishing work (+20 XP, +10 happiness)

Growth thresholds: **puppy** (0 XP) &rarr; **junior** (100 XP) &rarr; **adult** (300 XP). Evolution is checked and applied atomically on every XP gain.

### Row-Level Security

Every table has RLS enabled. The policy model:

- **Students** can only read/write their own data
- **Teachers** can read all student data and manage assignments/submissions
- **Support** users inherit teacher-level access
- Token transactions can only be created via SECURITY DEFINER RPCs (no direct inserts)
- All RPCs validate `auth.uid()` matches the caller before executing

See [`supabase/migrations/20260406_rls_and_rpc_auth.sql`](supabase/migrations/20260406_rls_and_rpc_auth.sql) for the full policy set.

## How the Plugin System Works

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

## API Documentation

See [PLUGIN_API.md](PLUGIN_API.md) for the full plugin developer reference, including manifest schema, postMessage protocol, lifecycle, and starter template.

## License

[GPLv3](./LICENSE)
