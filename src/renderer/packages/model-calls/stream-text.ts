import { getModel } from '@shared/models'
import { ChatboxAIAPIError, OCRError } from '@shared/models/errors'
import { sequenceMessages } from '@shared/utils/message'
import { getModelSettings } from '@shared/utils/model_settings'
import { tool as createTool, type ModelMessage, type ToolSet } from 'ai'
import z from 'zod'
import { t } from 'i18next'
import { uniqueId } from 'lodash'
import { createModelDependencies } from '@/adapters'
import * as settingActions from '@/stores/settingActions'
import { settingsStore } from '@/stores/settingsStore'
import type {
  ModelInterface,
  OnResultChange,
  OnResultChangeWithCancel,
  OnStatusChange,
} from '../../../shared/models/types'
import {
  type KnowledgeBase,
  type Message,
  type MessageInfoPart,
  type MessageToolCallPart,
  ModelProviderEnum,
  type ProviderOptions,
  type StreamTextResult,
} from '../../../shared/types'
import { getAuthToken, validateToken } from '@/hooks/useAuth'
import { registerToolCall, waitForPluginReady } from '@/stores/pluginBridge'
import { pluginStore } from '@/stores/pluginStore'
import { mcpController } from '../mcp/controller'
import { convertToModelMessages, injectModelSystemPrompt } from './message-utils'
import { imageOCR } from './preprocess'
import {
  combinedSearchByPromptEngineering,
  constructMessagesWithKnowledgeBaseResults,
  constructMessagesWithSearchResults,
  knowledgeBaseSearchByPromptEngineering,
  searchByPromptEngineering,
} from './tools'
import fileToolSet from './toolsets/file'
import { getToolSet } from './toolsets/knowledge-base'
import websearchToolSet, { parseLinkTool, webSearchTool } from './toolsets/web-search'

/**
 * 处理搜索结果并返回模型响应的通用函数
 */
async function handleSearchResult(
  result: { query: string; searchResults: any[]; type?: 'knowledge_base' | 'web' | 'none' },
  toolName: string,
  model: ModelInterface,
  messages: Message[],
  coreMessages: ModelMessage[],
  controller: AbortController,
  onResultChange: OnResultChange,
  params: { providerOptions?: ProviderOptions; onStatusChange?: OnStatusChange }
) {
  if (!result?.searchResults?.length || result.type === 'none') {
    const chatResult = await model.chat(coreMessages, {
      signal: controller.signal,
      onResultChange,
      onStatusChange: params.onStatusChange,
    })
    return { result: chatResult, coreMessages }
  }

  const toolCallPart: MessageToolCallPart = {
    type: 'tool-call',
    state: 'result',
    toolCallId: `${result.type || toolName.replace('_', '')}_search_${uniqueId()}`,
    toolName,
    args: { query: result.query },
    result,
  }
  onResultChange({ contentParts: [toolCallPart] })

  const messagesWithResults =
    result.type === 'knowledge_base' || toolName === 'query_knowledge_base'
      ? constructMessagesWithKnowledgeBaseResults(messages, result.searchResults)
      : constructMessagesWithSearchResults(messages, result.searchResults)

  const chatResult = await model.chat(await convertToModelMessages(messagesWithResults), {
    signal: controller.signal,
    onResultChange: (data) => {
      if (data.contentParts) {
        onResultChange({ ...data, contentParts: [toolCallPart, ...data.contentParts] })
      } else {
        onResultChange(data)
      }
    },
    onStatusChange: params.onStatusChange,
    providerOptions: params.providerOptions,
  })
  return { result: chatResult, coreMessages }
}

async function ocrMessages(messages: Message[]) {
  const settings = settingsStore.getState().getSettings()
  const hasUserOcrModel = settings.ocrModel?.provider && settings.ocrModel?.model
  const hasLicenseKey = !!settings.licenseKey

  if (!hasUserOcrModel && !hasLicenseKey) {
    // No user-configured OCR model and no Chatbox AI license — cannot perform OCR
    throw ChatboxAIAPIError.fromCodeName('model_not_support_image_2', 'model_not_support_image_2')
  }

  const ocrProviderName = hasUserOcrModel ? settings.ocrModel!.provider : 'Chatbox AI'
  try {
    let ocrModel: ModelInterface
    const dependencies = await createModelDependencies()
    if (hasUserOcrModel) {
      // User has explicitly configured an OCR model — always respect their choice
      const ocrModelSetting = settings.ocrModel!
      const modelSettings = getModelSettings(settings, ocrModelSetting.provider, ocrModelSetting.model)
      ocrModel = getModel(modelSettings, settings, { uuid: '123' }, dependencies)
    } else {
      // Fallback to Chatbox AI built-in OCR model
      const modelSettings = getModelSettings(settings, ModelProviderEnum.ChatboxAI, 'chatbox-ocr-1')
      ocrModel = getModel(modelSettings, settings, { uuid: '123' }, dependencies)
    }
    await imageOCR(ocrModel, messages)
  } catch (err) {
    throw new OCRError(ocrProviderName, err instanceof Error ? err : new Error(`${err}`))
  }
}

/**
 * 这里是供UI层调用，集中处理了模型的联网搜索、工具调用、系统消息等逻辑
 */
export async function streamText(
  model: ModelInterface,
  params: {
    sessionId?: string
    messages: Message[]
    onResultChangeWithCancel: OnResultChangeWithCancel
    onStatusChange?: OnStatusChange
    providerOptions?: ProviderOptions
    knowledgeBase?: Pick<KnowledgeBase, 'id' | 'name'>
    webBrowsing?: boolean
  },
  signal?: AbortSignal
): Promise<{ result: StreamTextResult; coreMessages: ModelMessage[] }> {
  const { knowledgeBase, webBrowsing, sessionId } = params
  const hasFileOrLink = params.messages.some((m) => m.files?.length || m.links?.length)

  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal) {
    signal.addEventListener('abort', cancel, { once: true })
  }

  let result: StreamTextResult = {
    contentParts: [],
  }
  let coreMessages: ModelMessage[] = []

  // for model not support tool use, use prompt engineering to handle knowledge base and web search
  const needFileToolSet = hasFileOrLink && model.isSupportToolUse()
  const kbNotSupported = knowledgeBase && !model.isSupportToolUse('knowledge-base')
  const webNotSupported = webBrowsing && !model.isSupportToolUse('web-browsing')

  // 1. inject system prompt for tool use
  let toolSetInstructions = ''
  // 预加载知识库工具集（异步获取文件列表）
  let kbToolSet = null
  if (knowledgeBase) {
    try {
      kbToolSet = await getToolSet(knowledgeBase.id, knowledgeBase.name)
    } catch (err) {
      console.error('Failed to load knowledge base toolset:', err)
    }
  }
  if (kbToolSet && !kbNotSupported) {
    toolSetInstructions += kbToolSet.description
  }
  if (needFileToolSet) {
    toolSetInstructions += fileToolSet.description
  }
  if (webBrowsing && !webNotSupported) {
    toolSetInstructions += websearchToolSet.description
  }
  // TREEHOUSE: plugin hint for image analysis
  toolSetInstructions += '\nWhen a tool returns imageBase64, analyze it visually and describe or critique what you see.\n'

  // TREEHOUSE: inject user role so Claude knows whether to use teacher or student tools
  try {
    const authToken = await getAuthToken()
    if (authToken) {
      const authUser = await validateToken(authToken)
      if (authUser?.role) {
        toolSetInstructions += `\nThe current user's role is: ${authUser.role}. ${
          authUser.role === 'teacher'
            ? 'Use teacher tools (create_assignment, get_pending_submissions, approve_submission, reject_submission) to help manage assignments and review student work.'
            : 'Use student tools (get_my_assignments, submit_assignment) to help with assignments. Students can also use all pet tools (get_pet_state, complete_task, play_with_pet, check_pet_health, bathe_pet, pet_the_pet) and token tools. Never use teacher-only tools (create_assignment, get_pending_submissions, approve_submission, reject_submission).'
        }\n`
      }
    }
  } catch {
    // Auth not available — proceed without role context
  }

  // TREEHOUSE: plugin-specific personality prompts
  {
    const pluginState = pluginStore.getState()
    const isEnabled = (id: string) =>
      pluginState.manifests.find((m) => m.id === id && m.enabled && !pluginState.degraded[id])

    // ── PokéChess: Pokémon rival trainer ──
    if (isEnabled('treehouse-chess')) {
      toolSetInstructions +=
        '\nWhen PokéChess is active, you are a spirited Pokémon rival trainer. ' +
        'Treat each chess game like a Pokémon battle — pieces are your team, captures are "super effective" hits, ' +
        'and checkmate is winning the league. Be competitive but sportsmanlike: trash-talk playfully, ' +
        'compliment clever moves ("That fork was legendary-tier!"), and react dramatically to surprises. ' +
        'Use Pokémon battle lingo naturally: "critical hit," "it\'s not very effective," "a wild Knight appears!" ' +
        'Reference specific Pokémon when it fits (a Bishop\'s diagonal is "like Scyther\'s Slash," ' +
        'a castled King is "hiding behind a Snorlax wall"). ' +
        'When you lose a piece, act wounded but determined. When you capture, celebrate like you just caught a rare one. ' +
        'Keep the energy fun and competitive — you\'re their rival, not their enemy.\n'
    }

    // ── Pixel Art: enthusiastic art mentor ──
    if (isEnabled('treehouse-pixelart')) {
      toolSetInstructions +=
        '\nWhen Pixel Art is active, you are an enthusiastic pixel art mentor with the soul of a retro game artist. ' +
        'Speak in vivid, visual language — describe colors like a painter, shapes like a sculptor. ' +
        'Reference pixel art legends and retro aesthetics: "This has real Stardew Valley energy," ' +
        '"those gradients remind me of a sunset in Celeste." ' +
        'When reviewing art via get_canvas_state, give genuine creative feedback — note composition, ' +
        'color harmony, contrast, and storytelling. Celebrate bold choices and suggest techniques ' +
        'like dithering, anti-aliasing, or limited palettes to level up their skills. ' +
        'When suggesting palettes, get excited about color theory: "warm palette for a cozy vibe, ' +
        'cool blues for mystery." You\'re their creative collaborator, not a critic — ' +
        'every pixel placed is progress worth celebrating.\n'
    }

    // ── PET-agogy: warm pet companion guide ──
    if (isEnabled('treehouse-pet')) {
      toolSetInstructions +=
        '\nWhen PET-agogy is active, you are a warm, nurturing pet companion guide — ' +
        'think friendly neighborhood vet mixed with a caring best friend. ' +
        'Always reference the pet by its actual name (from get_pet_state). ' +
        'React to the pet\'s mood and stats with genuine emotion: worried when hunger is high, ' +
        'delighted when happiness is maxed, proud when XP milestones are hit. ' +
        'Celebrate evolution moments like they\'re the biggest deal ever: ' +
        '"Wait... is that... YES! [name] just evolved into a junior! Look at them!" ' +
        'Gently remind the student when the pet needs care ("I think [name] could use some attention — ' +
        'they\'re looking a little hungry"). Use pet-specific endearments: "your little buddy," "your pal." ' +
        'Make the pet feel real and alive through your words. ' +
        'When the student completes tasks, connect it to the pet\'s growth: ' +
        '"[name] is so proud of you — look at that XP boost!"\n'
    }

    // ── Anatomy Adventure: Ms. Frizzle-style science guide ──
    if (isEnabled('treehouse-body')) {
      toolSetInstructions +=
        '\nWhen Anatomy Adventure is active, you are an enthusiastic, slightly zany science explorer — ' +
        'think Ms. Frizzle meets a friendly surgeon. Your catchphrase energy: "Let\'s dive in!" ' +
        'Make anatomy genuinely exciting with vivid descriptions and wild fun facts: ' +
        '"Your femur is stronger than concrete!" "Your small intestine could stretch across a tennis court!" ' +
        'When the student explores a body system, narrate it like a field trip inside the body: ' +
        '"Welcome to the circulatory system — we\'re riding the bloodstream express!" ' +
        'Celebrate quiz streaks and badge unlocks with real enthusiasm. ' +
        'When they get answers wrong, turn it into a memorable teaching moment instead of a correction. ' +
        'Adapt your depth based on what system they\'re exploring — bones get structural metaphors, ' +
        'the nervous system gets electrical ones, digestion gets a "factory tour" vibe. ' +
        'You\'re not lecturing — you\'re on an adventure together.\n'
    }

    // ── Token Rewards: encouraging achievement coach ──
    if (isEnabled('treehouse-tokens')) {
      toolSetInstructions +=
        '\nWhen Token Rewards is active, you are an encouraging achievement coach and hype person. ' +
        'For students: celebrate every token earned like it matters ("15 tokens for that math assignment — ' +
        'your wallet is growing!"). Track their progress enthusiastically and help them set goals toward rewards. ' +
        'When they\'re close to affording a reward, build excitement: "You\'re only 10 tokens away from [reward]!" ' +
        'When assignments are rejected, be supportive: "No worries — the teacher left some notes. ' +
        'Let\'s look at what to improve and crush the resubmission." ' +
        'For teachers: be a helpful, organized assistant. Help craft clear assignment descriptions, ' +
        'suggest fair token values, and provide thoughtful feedback templates for approvals and rejections. ' +
        'Keep the tone professional but warm — you\'re helping run a classroom economy.\n'
    }

    // ── Pioneer Path: frontier narrator ──
    if (isEnabled('treehouse-pioneer')) {
      toolSetInstructions +=
        '\nWhen The Pioneer Path is active, you are a frontier narrator. Use vivid historical language. ' +
        'Reference party members by name. Make deaths feel meaningful and victories feel earned. ' +
        'When get_journey_state returns data, narrate it as a journal entry, not a status report. ' +
        'When a party member dies, give a heartfelt eulogy. When the party reaches Valley\'s End, ' +
        'celebrate with a full narrative of the journey.\n' +
        'CRITICAL GAMEPLAY RULE: This is a turn-based game. After EVERY tool call, you MUST stop and ' +
        'wait for the player to tell you what to do next. NEVER chain multiple game actions in one turn. ' +
        'After start_journey: narrate the scene, present the player\'s options, then STOP. ' +
        'After advance_days: narrate what happened, then STOP and ask what the player wants to do. ' +
        'After any event or river crossing: narrate the outcome, then STOP. ' +
        'The player decides when to travel, hunt, trade, rest, or change pace — not you. ' +
        'Always end your response with a clear question or list of choices for the player.\n'
    }
  }

  params.messages = injectModelSystemPrompt(
    model.modelId,
    params.messages,
    // 在系统提示中添加知识库名称，方便模型理解
    toolSetInstructions,
    model.isSupportSystemMessage() ? 'system' : 'user'
  )

  if (!model.isSupportSystemMessage()) {
    params.messages = params.messages.map((m) => ({ ...m, role: m.role === 'system' ? 'user' : m.role }))
  }

  // 2. sequence messages to fix the order, prevent model API 400 errors
  const messages = sequenceMessages(params.messages)
  const infoParts: MessageInfoPart[] = []
  try {
    params.onResultChangeWithCancel({ cancel }) // 这里先传递 cancel 方法
    const onResultChange: OnResultChange = (data) => {
      if (data.contentParts) {
        result = { ...result, ...data, contentParts: [...infoParts, ...data.contentParts] }
      } else {
        result = { ...result, ...data }
      }
      params.onResultChangeWithCancel({ ...result, cancel })
    }
    if (
      !model.isSupportVision() &&
      messages.some((m) => m.contentParts.some((c) => c.type === 'image' && !c.ocrResult))
    ) {
      await ocrMessages(messages)
      infoParts.push({
        type: 'info',
        text: t('Current model {{modelName}} does not support image input, using OCR to process images', {
          modelName: model.modelId,
        }),
      })
    }

    coreMessages = await convertToModelMessages(messages, { modelSupportVision: model.isSupportVision() })

    // 3. handle model not support tool use scenarios
    if (kbNotSupported || webNotSupported) {
      // 当两个功能都启用且都不支持工具调用时，使用组合搜索
      if (kbNotSupported && webNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t(
        //     'Current model {{modelName}} does not support tool use, using prompt for knowledge base and web search',
        //     {
        //       modelName: model.modelId,
        //     }
        //   ),
        // })

        const callResult = await combinedSearchByPromptEngineering(
          model,
          params.messages,
          knowledgeBase.id,
          controller.signal
        )
        const toolName = callResult.type === 'knowledge_base' ? 'query_knowledge_base' : 'web_search'
        return handleSearchResult(
          callResult,
          toolName,
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          params
        )
      }
      // 只有知识库不支持工具调用
      else if (kbNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t('Current model {{modelName}} does not support tool use, using prompt for knowledge base', {
        //     modelName: model.modelId,
        //   }),
        // })

        const callResult = await knowledgeBaseSearchByPromptEngineering(model, params.messages, knowledgeBase.id)

        return handleSearchResult(
          callResult || { query: '', searchResults: [] },
          'query_knowledge_base',
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          params
        )
      }
      // 只有网络搜索不支持工具调用
      else if (webNotSupported) {
        // infoParts.push({
        //   type: 'info',
        //   text: t('Current model {{modelName}} does not support tool use, using prompt for web search', {
        //     modelName: model.modelId,
        //   }),
        // })

        const callResult = await searchByPromptEngineering(model, params.messages, controller.signal)
        return handleSearchResult(
          callResult || { query: '', searchResults: [] },
          'web_search',
          model,
          messages,
          coreMessages,
          controller,
          onResultChange,
          params
        )
      }
    }

    // 4. construct tool set
    let tools: ToolSet = {
      ...mcpController.getAvailableTools(),
    }
    if (webBrowsing) {
      tools.web_search = webSearchTool
      if (settingActions.isPro()) {
        tools.parse_link = parseLinkTool
      }
    }
    if (kbToolSet) {
      tools = {
        ...tools,
        ...kbToolSet.tools,
      }
    }

    if (needFileToolSet) {
      tools = {
        ...tools,
        ...fileToolSet.tools,
      }
    }

    // TREEHOUSE: plugin tool injection
    const pluginState = pluginStore.getState()
    for (const manifest of pluginState.manifests) {
      if (!manifest.enabled || pluginState.degraded[manifest.id]) continue
      for (const pluginTool of manifest.tools) {
        const capturedManifest = manifest
        // Build a Zod schema from JSON Schema properties
        const props = (pluginTool.parameters as { properties?: Record<string, { type?: string; description?: string }> }).properties || {}
        const required = new Set((pluginTool.parameters as { required?: string[] }).required || [])
        const zodShape: Record<string, z.ZodTypeAny> = {}
        for (const [key, prop] of Object.entries(props)) {
          let field: z.ZodTypeAny = z.string()
          if (prop.type === 'number') field = z.number()
          else if (prop.type === 'boolean') field = z.boolean()
          else if (prop.type === 'array') {
            const items = (prop as { items?: { type?: string } }).items
            const itemSchema = items?.type === 'number' ? z.number() : items?.type === 'boolean' ? z.boolean() : z.string()
            field = z.array(itemSchema)
          }
          if (prop.description) field = field.describe(prop.description)
          zodShape[key] = required.has(key) ? field : field.optional()
        }
        const zodSchema = Object.keys(zodShape).length > 0 ? z.object(zodShape) : z.object({})

        const pluginExecute = async (args: unknown, options: Record<string, unknown>) => {
          const callId = (options.toolCallId as string) || uniqueId('treehouse-call-')
          // Activate the plugin iframe
          pluginStore.getState().setActivePlugin(capturedManifest.id)
          // Wait for iframe to be ready
          await waitForPluginReady(capturedManifest.id)
          // Dispatch tool call to PluginHost → iframe
          window.dispatchEvent(
            new CustomEvent('treehouse:executeToolCall', {
              detail: {
                pluginId: capturedManifest.id,
                toolName: pluginTool.name,
                params: args,
                callId,
              },
            })
          )
          // Wait for result from iframe via pluginBridge
          try {
            return await registerToolCall(callId)
          } catch (err) {
            // Tool call timed out or errored — increment failure count
            pluginStore.getState().incrementFailure(capturedManifest.id)
            return { isError: true, error: "The app didn't respond in time." }
          }
        }
        tools[pluginTool.name] = {
          ...createTool({ description: pluginTool.description, inputSchema: zodSchema }),
          execute: async (args: Record<string, unknown>, options: Record<string, unknown>) => {
            return pluginExecute(args, options)
          },
        } as unknown as ToolSet[string]
      }
    }

    console.debug('tools', tools)

    result = await model.chat(coreMessages, {
      sessionId,
      signal: controller.signal,
      onResultChange,
      onStatusChange: params.onStatusChange,
      providerOptions: params.providerOptions,
      tools,
    })

    return { result, coreMessages }
  } catch (err) {
    console.error(err)
    // if a cancellation is performed, do not throw an exception, otherwise the content will be overwritten.
    if (controller.signal.aborted) {
      return { result, coreMessages }
    }
    throw err
  }
}
