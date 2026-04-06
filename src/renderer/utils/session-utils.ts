import type { Session, SessionMeta } from '@shared/types'
import { mapValues } from 'lodash'
import { migrateMessage } from '../../shared/utils/message'

export function migrateSession(session: Session): Session {
  return {
    ...session,
    settings: {
      // temperature未设置的时候使用默认值undefined，这样才能覆盖全局设置
      temperature: undefined,
      ...session.settings,
    },
    messages: session.messages?.map((m) => migrateMessage(m)) || [],
    threads: session.threads?.map((t) => ({
      ...t,
      messages: t.messages.map((m) => migrateMessage(m)) || [],
    })),
    messageForksHash: mapValues(session.messageForksHash || {}, (forks) => ({
      ...forks,
      lists:
        forks.lists?.map((list) => ({
          ...list,
          messages: list.messages?.map((m) => migrateMessage(m)) || [],
        })) || [],
    })),
  }
}

// Pre-built demo/example session IDs that should be hidden from the sidebar
const ARCHIVED_SESSION_IDS = new Set([
  // EN examples
  '6dafa15e-c72f-4036-ac89-33c09e875bdc', // Markdown 101 (Example)
  'e22ab364-4681-4e24-aaba-461ed0fccfd3', // Travel Guide (Example)
  '55d92e88-02af-4c3b-a378-aa0a1970abb1', // Social Media Influencer (Example)
  '35df5a96-b612-406a-985b-3ab4d2c481ff', // Software Developer (Example)
  '776eac23-7b4a-40da-91cd-f233bb4742ed', // Translator (Example)
  // CN examples
  '81cfc426-48b4-4a13-ad42-bfcfc4544299', // 小红书文案生成器 (示例)
  '8732ec08-b23c-4b5e-8f65-d63d808f970f', // 夸夸机 (示例)
  '3e091ac6-ebfa-42c9-b125-c67ac2d45ee1', // 翻译助手 (示例)
  // Image Creator
  'chatbox-chat-demo-image-creator',
  // Snake Game (Artifact)
  'chatbox-chat-demo-artifact-1-cn',
  'chatbox-chat-demo-artifact-1-en',
  // ChartWhiz / 做图表
  'mermaid-demo-1-en',
  'mermaid-demo-1-cn',
])

export function sortSessions(sessions: SessionMeta[]): SessionMeta[] {
  const reversed: SessionMeta[] = []
  const pinned: SessionMeta[] = []
  for (const sess of sessions) {
    // Skip hidden or archived example sessions
    if (sess.hidden || ARCHIVED_SESSION_IDS.has(sess.id)) {
      continue
    }
    if (sess.starred) {
      pinned.push(sess)
      continue
    }
    reversed.unshift(sess)
  }
  return pinned.concat(reversed)
}
