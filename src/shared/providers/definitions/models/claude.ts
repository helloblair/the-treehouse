import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic'
import AbstractAISDKModel, { type CallSettings } from '../../../models/abstract-ai-sdk'
import { ApiError } from '../../../models/errors'
import type { CallChatCompletionOptions } from '../../../models/types'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { normalizeClaudeHost } from '../../../utils/llm_utils'

interface Options {
  claudeApiKey: string
  claudeApiHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  extraHeaders?: Record<string, string>
  customFetch?: typeof globalThis.fetch
  authToken?: string
  isOAuth?: boolean
}

export default class Claude extends AbstractAISDKModel {
  public name = 'Claude'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
  }

  private isWebPlatform() {
    // Vite inlines CHATBOX_BUILD_PLATFORM at build time; avoid a runtime
    // `typeof process` guard that can fail in browsers without a polyfill.
    try {
      return process.env.CHATBOX_BUILD_PLATFORM === 'web'
    } catch {
      return false
    }
  }

  /**
   * Creates a fetch wrapper that redirects Anthropic API calls through the
   * serverless proxy at /api/claude, keeping the API key server-side. Every
   * proxied request carries the user's Supabase JWT in the `x-treehouse-auth`
   * header so the edge function can authenticate the caller and refuse
   * unauthenticated traffic — without auth, /api/claude would let anyone on
   * the internet burn the platform's Anthropic credits.
   */
  private createProxyFetch(): typeof globalThis.fetch {
    const baseFetch = this.options.customFetch || globalThis.fetch
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      // Rewrite Anthropic URLs to our proxy, passing the original path as a query param
      if (url.includes('api.anthropic.com')) {
        const parsed = new URL(url)
        const proxyUrl = `/api/claude?path=${encodeURIComponent(parsed.pathname)}`
        // Strip the api key header — the proxy injects it server-side
        const headers = new Headers(init?.headers)
        headers.delete('x-api-key')
        headers.delete('authorization')
        headers.delete('anthropic-dangerous-direct-browser-access')
        // Attach the renderer's Supabase JWT via the bridge installed by
        // src/renderer/hooks/useAuth.ts. Read at request time so token
        // refreshes are picked up automatically.
        const tokenGetter = (
          globalThis as { __treehouseGetAuthToken?: () => Promise<string | null> }
        ).__treehouseGetAuthToken
        const treehouseToken = tokenGetter ? await tokenGetter() : null
        if (treehouseToken) {
          headers.set('x-treehouse-auth', `Bearer ${treehouseToken}`)
        }
        return baseFetch(proxyUrl, { ...init, headers })
      }
      return baseFetch(input, init)
    }
  }

  protected getProvider() {
    // On web deployments without a user-provided key, route through the serverless proxy
    const useProxy = this.isWebPlatform() && !this.options.claudeApiKey && !this.options.authToken

    if (useProxy) {
      return createAnthropic({
        apiKey: 'proxy', // placeholder — the proxy injects the real key server-side
        baseURL: normalizeClaudeHost(this.options.claudeApiHost).apiHost,
        fetch: this.createProxyFetch(),
        headers: {
          ...this.options.extraHeaders,
        },
      })
    }

    const authOptions = this.options.authToken
      ? { authToken: this.options.authToken }
      : { apiKey: this.options.claudeApiKey }
    return createAnthropic({
      ...authOptions,
      baseURL: normalizeClaudeHost(this.options.claudeApiHost).apiHost,
      fetch: this.options.customFetch,
      headers: {
        'anthropic-dangerous-direct-browser-access': 'true',
        ...this.options.extraHeaders,
      },
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return provider.languageModel(this.options.model.modelId)
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const isModelSupportReasoning = this.isSupportReasoning()
    let providerOptions = {} as { anthropic: AnthropicProviderOptions }
    if (isModelSupportReasoning) {
      providerOptions = {
        anthropic: {
          ...(options.providerOptions?.claude || {}),
        },
      }
    }

    // Anthropic API requires only one of temperature or topP to be specified
    // Prefer temperature as recommended by Anthropic
    const callSettings: CallSettings = {
      providerOptions,
      maxOutputTokens: this.options.maxOutputTokens,
    }

    // Only include temperature or topP if defined, and only one of them
    if (this.options.temperature !== undefined) {
      callSettings.temperature = this.options.temperature
    } else if (this.options.topP !== undefined) {
      callSettings.topP = this.options.topP
    }

    // Anthropic OAuth tokens require Claude Code identity passphrase as the first system block
    if (this.options.isOAuth) {
      callSettings.system = "You are Claude Code, Anthropic's official CLI for Claude."
    }

    return callSettings
  }

  // https://docs.anthropic.com/en/docs/api/models
  public async listModels(): Promise<ProviderModelInfo[]> {
    type Response = {
      data: { id: string; type: string }[]
    }
    const url = `${this.options.claudeApiHost}/models?limit=990`
    const headers: Record<string, string> = {
      'anthropic-version': '2023-06-01',
      ...this.options.extraHeaders,
    }
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`
    } else if (this.options.claudeApiKey) {
      headers['x-api-key'] = this.options.claudeApiKey
    }
    const res = await this.dependencies.request.apiRequest({
      url: url,
      method: 'GET',
      headers,
    })
    const json: Response = await res.json()
    if (!json['data']) {
      throw new ApiError(JSON.stringify(json))
    }
    return json['data']
      .filter((item) => item.type === 'model')
      .map((item) => ({
        modelId: item.id,
        type: 'chat',
      }))
  }
}
