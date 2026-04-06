# Treehouse Plugin API Reference

This document covers everything you need to build a third-party plugin for The Treehouse. A plugin is a standalone web app that runs inside an iframe, communicates with the platform via `postMessage`, and exposes tool schemas that Claude can invoke during conversation.

---

## Table of Contents

1. [Plugin Manifest](#1-plugin-manifest)
2. [postMessage Protocol](#2-postmessage-protocol)
3. [Plugin Lifecycle](#3-plugin-lifecycle)
4. [MCP Server Requirements](#4-mcp-server-requirements)
5. [Authentication Flow](#5-authentication-flow)
6. [Error Handling](#6-error-handling)
7. [Sandbox Policy](#7-sandbox-policy)

---

## 1. Plugin Manifest

Every plugin is described by a manifest object registered in the platform. The manifest tells the platform where to load the iframe, what tools it exposes, and how to communicate with it.

### Schema

```typescript
interface PluginManifest {
  id: string              // Unique plugin identifier (e.g. "treehouse-chess")
  name: string            // Human-readable display name (e.g. "PokéChess")
  iframeUrl: string       // URL of the plugin web app
  mcpServerUrl: string    // Base URL for the MCP /tools endpoint
  tools: ToolSchema[]     // Array of tool definitions Claude can invoke
  authConfig?: OAuthConfig // Optional OAuth configuration
  sandboxPolicy: string   // iframe sandbox attribute value
  enabled: boolean        // Whether the plugin is active
}

interface ToolSchema {
  name: string                        // Tool name (e.g. "start_game")
  description: string                 // Description shown to Claude
  parameters: Record<string, unknown> // JSON Schema for tool parameters
}

interface OAuthConfig {
  authorizationUrl: string  // OAuth authorization endpoint
  tokenUrl: string          // Token exchange endpoint
  clientId: string          // OAuth client ID
  scopes: string[]          // Requested OAuth scopes
}
```

### Field Details

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique identifier. Convention: `treehouse-<name>`. |
| `name` | `string` | Yes | Display name shown in the plugin sidebar. |
| `iframeUrl` | `string` | Yes | Full URL to the plugin's entry page. Used as the iframe `src`. |
| `mcpServerUrl` | `string` | Yes | Base URL for the MCP server. The platform appends `/tools` to fetch schemas. |
| `tools` | `ToolSchema[]` | Yes | Array of tool definitions. If empty, the platform fetches them from `mcpServerUrl/tools`. |
| `authConfig` | `OAuthConfig` | No | If present, the platform can run an OAuth flow before activating the plugin. |
| `sandboxPolicy` | `string` | Yes | Value for the iframe `sandbox` attribute. Use `"allow-scripts allow-same-origin"` unless you need more. |
| `enabled` | `boolean` | Yes | Whether this plugin is active. Disabled plugins are skipped during tool injection. |

### Example Manifest

```json
{
  "id": "treehouse-hello",
  "name": "Hello World",
  "iframeUrl": "https://my-plugin.vercel.app",
  "mcpServerUrl": "https://my-plugin.vercel.app/mcp",
  "tools": [
    {
      "name": "say_hello",
      "description": "Say hello to the user with a custom greeting",
      "parameters": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Name to greet" }
        },
        "required": ["name"],
        "additionalProperties": false
      }
    }
  ],
  "sandboxPolicy": "allow-scripts allow-same-origin",
  "enabled": true
}
```

---

## 2. postMessage Protocol

All communication between the platform (parent window) and plugins (iframes) uses `window.postMessage`. Every message is a plain object with a `type`, `pluginId`, and `payload`.

### Base Message Shape

```typescript
interface TreehouseMessage {
  type: string      // One of the TREEHOUSE_ constants below
  pluginId: string  // The plugin's manifest id
  payload: unknown  // Type-specific data
}
```

### Message Types

There are 8 message types. 5 are sent by the plugin to the parent, 2 are sent by the parent to the plugin, and 1 is used for OAuth callbacks.

#### Plugin → Parent Messages

---

#### `TREEHOUSE_READY`

Sent by the plugin when it has finished loading and is ready to receive tool calls.

**Direction:** Plugin → Parent

**When to send:** Once, on initial load (e.g. in a `useEffect` or `window.onload`).

**Payload:** None required.

```javascript
window.parent.postMessage({
  type: 'TREEHOUSE_READY',
  pluginId: 'treehouse-hello',
  payload: {}
}, PLATFORM_ORIGIN);
```

**Platform behavior:** Marks the plugin as ready, clears the loading spinner, cancels the 10-second load timeout, and restores any cached state via `TREEHOUSE_RESTORE_STATE`.

---

#### `TREEHOUSE_TOOL_RESULT`

Sent by the plugin after processing a `TREEHOUSE_TOOL_CALL`. Returns the result to Claude.

**Direction:** Plugin → Parent

**When to send:** After handling a tool call. Must include the same `callId` from the incoming `TREEHOUSE_TOOL_CALL`.

**Payload:**

```typescript
{
  callId: string    // Must match the callId from the TOOL_CALL
  result: unknown   // The tool result — any JSON-serializable value
  isError?: boolean // If true, the result is treated as an error message
}
```

```javascript
window.parent.postMessage({
  type: 'TREEHOUSE_TOOL_RESULT',
  pluginId: 'treehouse-hello',
  payload: {
    callId: 'say_hello_1234567890',
    result: { message: 'Hello, World!' },
    isError: false
  }
}, PLATFORM_ORIGIN);
```

**Platform behavior:** Resolves the pending promise in `pluginBridge`, allowing Claude's tool execution to complete. If `isError` is true, the promise rejects and Claude sees the error.

---

#### `TREEHOUSE_COMPLETION`

Sent by the plugin when the user has finished their task (e.g. completed a drawing, finished a game).

**Direction:** Plugin → Parent

**When to send:** When the plugin's primary task is done and the result should enter the conversation.

**Payload:** None required.

```javascript
window.parent.postMessage({
  type: 'TREEHOUSE_COMPLETION',
  pluginId: 'treehouse-hello',
  payload: {}
}, PLATFORM_ORIGIN);
```

**Platform behavior:** Auto-submits a user message to the chat (e.g. "I finished my drawing! What do you think?") and triggers a Claude response.

---

#### `TREEHOUSE_STATE_UPDATE`

Sent by the plugin to persist state in the platform. Use this for cross-session state restoration.

**Direction:** Plugin → Parent

**When to send:** Whenever meaningful state changes (e.g. board position, canvas data, score updates).

**Payload:**

```typescript
{
  state: unknown         // Any JSON-serializable state object
  userMessage?: string   // Optional: auto-submits a user message to the chat
}
```

```javascript
window.parent.postMessage({
  type: 'TREEHOUSE_STATE_UPDATE',
  pluginId: 'treehouse-hello',
  payload: {
    state: { score: 42, level: 3 },
    userMessage: 'I just reached level 3!'
  }
}, PLATFORM_ORIGIN);
```

**Platform behavior:**
- Caches the state in memory for instant restore within the session.
- For non-self-persisted plugins, saves to Supabase (debounced 2 seconds) for cross-session restore.
- If `userMessage` is present, auto-submits it as a user message and triggers a Claude response.

---

#### `TREEHOUSE_ERROR`

Sent by the plugin when something goes wrong.

**Direction:** Plugin → Parent

**When to send:** When the plugin encounters an error it wants the platform to know about.

**Payload:**

```typescript
{
  message?: string  // Human-readable error description
  error?: string    // Alternative field for the error message
  fatal?: boolean   // If true, the plugin is dismissed and a recovery message is sent
}
```

```javascript
// Non-fatal error (logged as warning, plugin stays open)
window.parent.postMessage({
  type: 'TREEHOUSE_ERROR',
  pluginId: 'treehouse-hello',
  payload: {
    message: 'Failed to load sprite sheet',
    fatal: false
  }
}, PLATFORM_ORIGIN);

// Fatal error (plugin dismissed, recovery message sent to chat)
window.parent.postMessage({
  type: 'TREEHOUSE_ERROR',
  pluginId: 'treehouse-hello',
  payload: {
    message: 'Database connection lost',
    fatal: true
  }
}, PLATFORM_ORIGIN);
```

**Platform behavior:**
- **Non-fatal:** Logs a console warning. Plugin stays active.
- **Fatal:** Dismisses the plugin iframe, increments the failure counter, and sends a recovery message to chat. After 3 fatal errors, the plugin is marked as degraded and excluded from tool injection.

---

#### Parent → Plugin Messages

---

#### `TREEHOUSE_TOOL_CALL`

Sent by the platform when Claude invokes one of the plugin's tools.

**Direction:** Parent → Plugin

**When received:** During Claude's response generation, when it calls a tool matching your manifest.

**Payload:**

```typescript
{
  callId: string      // Unique identifier for this tool call
  toolName: string    // Name of the tool being invoked
  params: unknown     // Parameters passed by Claude (matches your tool's JSON Schema)
}
```

```javascript
// Example incoming message
{
  type: 'TREEHOUSE_TOOL_CALL',
  pluginId: 'treehouse-hello',
  payload: {
    callId: 'say_hello_1712345678901',
    toolName: 'say_hello',
    params: { name: 'Student' }
  }
}
```

**Your responsibility:** Handle the tool call and respond with `TREEHOUSE_TOOL_RESULT` using the same `callId`. You have 30 seconds before the call times out.

---

#### `TREEHOUSE_RESTORE_STATE`

Sent by the platform immediately after `TREEHOUSE_READY` if there is cached state from a previous session.

**Direction:** Parent → Plugin

**When received:** Right after your `TREEHOUSE_READY` is acknowledged, if state exists.

**Payload:**

```typescript
{
  state: unknown  // The state object you previously sent via TREEHOUSE_STATE_UPDATE
}
```

```javascript
// Example incoming message
{
  type: 'TREEHOUSE_RESTORE_STATE',
  pluginId: 'treehouse-hello',
  payload: {
    state: { score: 42, level: 3 }
  }
}
```

**Your responsibility:** Restore your UI to match the received state.

---

#### OAuth Messages

---

#### `TREEHOUSE_AUTH_TOKEN`

Used internally during the OAuth popup flow. The OAuth callback page posts this message to the parent window with the authorization code.

**Direction:** OAuth popup → Parent window

**Payload:**

```typescript
{
  pluginId: string  // The plugin requesting auth
  code: string      // OAuth authorization code
}
```

This message is handled automatically by the platform's `useOAuth` hook. Plugin developers do not need to send or listen for this message unless implementing a custom OAuth callback page.

---

## 3. Plugin Lifecycle

The full lifecycle of a Treehouse plugin, from registration to dismissal:

### Step 1: Registration

The plugin manifest is registered in the platform's plugin store. For built-in plugins, this happens in `pluginRegistry.ts` at startup via `seedDefaultPlugins()`. Third-party plugins would register their manifest through the platform's plugin management UI.

### Step 2: Schema Discovery

If the manifest's `tools` array is empty, the platform fetches tool schemas from `{mcpServerUrl}/tools`. If tools are already defined in the manifest, this step is skipped.

### Step 3: Activation

When a user or Claude triggers a plugin (e.g. "let's play chess"), the platform sets the active plugin ID. The `PluginHost` component renders an iframe with the plugin's `iframeUrl` as the `src`.

### Step 4: Ready Signal

The plugin loads in the iframe and posts `TREEHOUSE_READY`. The platform:
- Marks the plugin as ready in the bridge
- Clears the 10-second load timeout
- Sends `TREEHOUSE_RESTORE_STATE` if cached state exists (from memory or Supabase)
- For plugins that need user context (pet, tokens), sends an init tool call with `userId` and `role`

If `TREEHOUSE_READY` is not received within 10 seconds, the plugin is dismissed and a failure is recorded.

### Step 5: Tool Execution

During Claude's streaming response, when a tool call chunk matches a plugin's tool:
1. The stream processor dispatches a `treehouse:toolCall` custom event
2. `stream-text.ts` registers a promise in `pluginBridge` and dispatches `treehouse:executeToolCall`
3. `PluginHost` forwards the tool call to the iframe via `postMessage` (`TREEHOUSE_TOOL_CALL`)
4. The plugin handles the call and responds with `TREEHOUSE_TOOL_RESULT`
5. The bridge resolves the promise and Claude receives the result

Tool calls time out after **30 seconds**.

### Step 6: State Persistence

During interaction, the plugin sends `TREEHOUSE_STATE_UPDATE` whenever state changes. The platform:
- Caches state in memory (instant restore within the session)
- Persists to Supabase with a 2-second debounce (cross-session restore)
- Optionally auto-submits a user message if `userMessage` is included

Plugins that manage their own Supabase persistence (pet, tokens, pioneer) are marked as "self-persisted" and skip platform-side Supabase writes.

### Step 7: Completion

When the user finishes their task, the plugin sends `TREEHOUSE_COMPLETION`. The platform auto-submits a user message to the conversation, allowing Claude to react to the completed work.

### Step 8: Dismissal

The plugin is dismissed when:
- The user closes it manually
- A fatal error occurs
- The load timeout expires
- The platform calls `dismissPlugin()`

On dismissal, `PluginHost` unmounts the iframe and `clearPluginReady` is called. Cached state is retained for future sessions.

---

## 4. MCP Server Requirements

Each plugin can optionally expose an MCP (Model Context Protocol) server endpoint for dynamic tool schema discovery. This is only needed if your manifest's `tools` array is empty.

### Endpoint

```
GET {mcpServerUrl}/tools
```

### Response Format

```json
{
  "tools": [
    {
      "name": "say_hello",
      "description": "Say hello to the user",
      "parameters": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Name to greet" }
        },
        "required": ["name"],
        "additionalProperties": false
      }
    }
  ]
}
```

### Requirements

- Must return `Content-Type: application/json`
- Must include `Access-Control-Allow-Origin: *` for CORS
- Must respond within **5 seconds** (the platform aborts after this timeout)
- Must return a `{ tools: ToolSchema[] }` object
- Each tool's `parameters` must be valid JSON Schema

### Implementation Example (Vite Plugin)

If your plugin uses Vite, you can serve the MCP endpoint directly from `vite.config.ts`:

```typescript
import { defineConfig, type Plugin } from 'vite'

const tools = [
  {
    name: 'say_hello',
    description: 'Say hello to the user',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' }
      },
      required: ['name'],
      additionalProperties: false
    }
  }
]

function mcpServerPlugin(): Plugin {
  return {
    name: 'my-plugin-mcp-server',
    configureServer(server) {
      server.middlewares.use('/mcp/tools', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ tools }))
      })
    },
  }
}

export default defineConfig({
  plugins: [mcpServerPlugin()],
})
```

### When to Use MCP vs. Manifest Tools

- **Manifest tools (recommended):** Define tools directly in the manifest's `tools` array. The platform uses these immediately without any network request. This is the approach all built-in plugins use.
- **MCP endpoint:** Use this only if your tool schemas change dynamically at runtime. The platform fetches from MCP only when the manifest's `tools` array is empty.

---

## 5. Authentication Flow

Plugins that need user authorization (e.g. accessing a third-party API) can use the platform's built-in OAuth PKCE flow.

### Setup

Add an `authConfig` to your manifest:

```json
{
  "authConfig": {
    "authorizationUrl": "https://accounts.example.com/authorize",
    "tokenUrl": "https://accounts.example.com/token",
    "clientId": "your-client-id",
    "scopes": ["read", "write"]
  }
}
```

### Flow

1. **User clicks login** — the platform's `useOAuth` hook constructs an authorization URL with PKCE (`code_challenge` + `code_challenge_method=S256`).
2. **Popup opens** — `window.open()` opens the OAuth provider's consent screen (500x700 popup window).
3. **User authorizes** — the provider redirects to `{window.location.origin}/oauth/callback`.
4. **Callback posts code** — the callback page posts a `TREEHOUSE_AUTH_TOKEN` message with the authorization code.
5. **Token exchange** — the platform exchanges the code for tokens at `authConfig.tokenUrl` using the PKCE code verifier.
6. **Token stored** — the access token (and optional refresh token) are stored in the plugin store.
7. **Token refresh** — when the token expires, the platform uses the refresh token to obtain a new access token automatically.

### Token Expiry

- Tokens include an `expiresAt` timestamp (defaults to 1 hour if the provider doesn't specify `expires_in`).
- The `useOAuth` hook exposes `isOAuthExpired` for UI indication.
- Call `refresh()` to silently refresh using the stored refresh token.
- If refresh fails, the user is logged out and must re-authorize.

---

## 6. Error Handling

### Plugin-Side Errors

Send `TREEHOUSE_ERROR` with the appropriate severity:

```javascript
// Non-fatal: the plugin can continue operating
window.parent.postMessage({
  type: 'TREEHOUSE_ERROR',
  pluginId: 'my-plugin',
  payload: {
    message: 'Could not load optional resource',
    fatal: false
  }
}, PLATFORM_ORIGIN);

// Fatal: the plugin cannot continue
window.parent.postMessage({
  type: 'TREEHOUSE_ERROR',
  pluginId: 'my-plugin',
  payload: {
    message: 'Critical initialization failure',
    fatal: true
  }
}, PLATFORM_ORIGIN);
```

### Tool Call Errors

Return errors through `TREEHOUSE_TOOL_RESULT` with `isError: true`:

```javascript
window.parent.postMessage({
  type: 'TREEHOUSE_TOOL_RESULT',
  pluginId: 'my-plugin',
  payload: {
    callId: callId,
    result: 'Invalid move: e5 is not a legal move in this position',
    isError: true
  }
}, PLATFORM_ORIGIN);
```

Claude sees the error as a tool result and can retry or inform the user.

### Platform-Side Error Handling

| Scenario | Platform behavior |
|---|---|
| Plugin doesn't send `TREEHOUSE_READY` within 10s | Iframe dismissed, failure incremented, recovery message sent to chat |
| Tool call not answered within 30s | Promise rejected with timeout error, Claude sees the error |
| 3 fatal errors from the same plugin | Plugin marked as **degraded** — excluded from tool injection and tool calls |
| `TREEHOUSE_TOOL_RESULT` with `isError: true` | Bridge promise rejects, Claude receives the error as the tool result |

### Degraded Mode

After 3 fatal errors, a plugin enters degraded mode:
- Its tools are no longer injected into Claude's context
- Tool calls to the plugin are skipped in the stream processor
- The failure count and degraded state are cleared on next platform restart

---

## 7. Sandbox Policy

Plugin iframes are sandboxed using the HTML `sandbox` attribute. The manifest's `sandboxPolicy` string is applied directly.

### Recommended Policy

```
allow-scripts allow-same-origin
```

This is the minimum required for a functional plugin:

| Attribute | Why it's needed |
|---|---|
| `allow-scripts` | Required for JavaScript execution in the iframe |
| `allow-same-origin` | Required for `postMessage` to work with origin validation |

### Additional Attributes

Only add these if your plugin genuinely needs them:

| Attribute | Use case | Risk |
|---|---|---|
| `allow-popups` | OAuth login flows that open a popup | Low — popups are visible to the user |
| `allow-forms` | Submitting HTML forms | Low — only affects the iframe |
| `allow-modals` | Using `alert()`, `confirm()`, `prompt()` | Low — browser-native dialogs |
| `allow-top-navigation` | Navigating the parent page | **High** — never use this |
| `allow-downloads` | Triggering file downloads | Medium — could be confusing |

### What to Avoid

- **Never use `allow-top-navigation`** — a plugin should not be able to navigate the parent window.
- **Never use `allow-top-navigation-by-user-activation`** — same risk, just with a click gate.
- **Avoid `allow-same-origin` without `allow-scripts`** — the combination is specifically what enables `postMessage`. Using `allow-same-origin` alone has no benefit for plugins.

### Policy in Manifest

```json
{
  "sandboxPolicy": "allow-scripts allow-same-origin"
}
```

If the `sandboxPolicy` field is empty or omitted, the iframe renders **without** a sandbox attribute (fully unsandboxed), which is less secure. Always specify a policy.

---

## Quick Reference

### All Message Types

| Type | Direction | Purpose |
|---|---|---|
| `TREEHOUSE_READY` | Plugin → Parent | Plugin finished loading |
| `TREEHOUSE_TOOL_CALL` | Parent → Plugin | Claude invoked a tool |
| `TREEHOUSE_TOOL_RESULT` | Plugin → Parent | Tool call response |
| `TREEHOUSE_COMPLETION` | Plugin → Parent | User finished their task |
| `TREEHOUSE_STATE_UPDATE` | Plugin → Parent | Persist plugin state |
| `TREEHOUSE_RESTORE_STATE` | Parent → Plugin | Restore cached state |
| `TREEHOUSE_ERROR` | Plugin → Parent | Report an error |
| `TREEHOUSE_AUTH_TOKEN` | OAuth popup → Parent | OAuth authorization code |

### Timeouts

| Event | Timeout |
|---|---|
| Plugin load (`TREEHOUSE_READY`) | 10 seconds |
| Tool call (`TREEHOUSE_TOOL_RESULT`) | 30 seconds |
| MCP schema fetch (`/tools`) | 5 seconds |
| OAuth consent | 5 minutes |

### Starter Template

See [treehouse-chess/docs/starter-template.html](treehouse-chess/docs/starter-template.html) for a minimal, self-contained plugin implementation with line-by-line comments.
