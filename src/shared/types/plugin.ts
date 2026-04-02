export interface PluginManifest {
  id: string
  name: string
  iframeUrl: string
  mcpServerUrl: string
  tools: ToolSchema[]
  authConfig?: OAuthConfig
  sandboxPolicy: string
  enabled: boolean
}

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface OAuthConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  scopes: string[]
}

export interface OAuthToken {
  access_token: string
  refresh_token?: string
  expiresAt: number
}

export const PostMessageType = {
  READY: 'TREEHOUSE_READY',
  TOOL_CALL: 'TREEHOUSE_TOOL_CALL',
  TOOL_RESULT: 'TREEHOUSE_TOOL_RESULT',
  STATE_UPDATE: 'TREEHOUSE_STATE_UPDATE',
  COMPLETION: 'TREEHOUSE_COMPLETION',
  ERROR: 'TREEHOUSE_ERROR',
  AUTH_TOKEN: 'TREEHOUSE_AUTH_TOKEN',
} as const

export interface TreehouseMessage {
  type: (typeof PostMessageType)[keyof typeof PostMessageType]
  pluginId: string
  payload: unknown
}

export function validateOrigin(event: MessageEvent, manifest: PluginManifest): boolean {
  try {
    const url = new URL(manifest.iframeUrl)
    return event.origin === url.origin
  } catch {
    return false
  }
}
