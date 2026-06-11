import type { ChatMessage, ConversationMeta } from "@/types"

const META_KEY_PREFIX = "conv_meta_"
const MSGS_KEY_PREFIX = "chat_history_"
const OLD_KEY_PREFIX = "chat_history_"

export interface ConvMetaEntry {
  title: string
  pinned: boolean
  created_at: string
}

export interface ConversationsStore {
  conversations: Record<string, ConvMetaEntry>
  activeConvId: string | null
}

function getMetaKey(notebookId: string): string {
  return `${META_KEY_PREFIX}${notebookId}`
}

function getMsgsKey(notebookId: string, convId: string): string {
  return `${MSGS_KEY_PREFIX}${notebookId}_${convId}`
}

function getOldMsgsKey(notebookId: string): string {
  return `${OLD_KEY_PREFIX}${notebookId}`
}

function generateConvId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Generate a conversation title from text via smart truncation at a word boundary.
 * Mirrors the backend _generate_title() logic.
 */
export function generateTitle(text: string, maxChars: number = 50): string {
  if (text.length <= maxChars) return text
  const truncated = text.slice(0, maxChars)
  const lastSpace = truncated.lastIndexOf(" ")
  if (lastSpace > 10) return truncated.slice(0, lastSpace) + "…"
  return truncated + "…"
}

/**
 * Load conversation metadata for a notebook.
 * Auto-migrates old flat-format data (`chat_history_{id}`) into the
 * per-conversation format on first load, then removes the old key.
 */
export function loadConversations(notebookId: string): ConversationsStore {
  try {
    const metaRaw = localStorage.getItem(getMetaKey(notebookId))
    if (metaRaw) {
      return JSON.parse(metaRaw) as ConversationsStore
    }
  } catch { /* corrupted data — fall through to empty */ }

  // Auto-migrate from old single-conversation flat format
  try {
    const oldRaw = localStorage.getItem(getOldMsgsKey(notebookId))
    if (oldRaw) {
      const oldMessages: ChatMessage[] = JSON.parse(oldRaw)
      const firstUserMsg = oldMessages.find((m) => m.role === "user")
      const convId = generateConvId()
      const title = firstUserMsg ? generateTitle(firstUserMsg.content) : "未命名对话"
      const store: ConversationsStore = {
        conversations: {
          [convId]: {
            title,
            pinned: false,
            created_at: oldMessages[0]?.timestamp || new Date().toISOString(),
          },
        },
        activeConvId: convId,
      }
      saveConversations(notebookId, store)
      saveMessages(notebookId, convId, oldMessages)
      localStorage.removeItem(getOldMsgsKey(notebookId))
      return store
    }
  } catch { /* migration failed — start fresh */ }

  return { conversations: {}, activeConvId: null }
}

/**
 * Persist conversation metadata for a notebook.
 */
export function saveConversations(notebookId: string, store: ConversationsStore): void {
  try {
    localStorage.setItem(getMetaKey(notebookId), JSON.stringify(store))
  } catch { /* quota exceeded or unavailable */ }
}

/**
 * Load messages for a specific conversation.
 */
export function loadMessages(notebookId: string, convId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getMsgsKey(notebookId, convId))
    if (raw) return JSON.parse(raw) as ChatMessage[]
  } catch { }
  return []
}

/**
 * Persist messages for a specific conversation.
 */
export function saveMessages(notebookId: string, convId: string, msgs: ChatMessage[]): void {
  try {
    localStorage.setItem(getMsgsKey(notebookId, convId), JSON.stringify(msgs))
  } catch { }
}

/**
 * Delete a conversation — removes both its messages and its metadata entry.
 * If the deleted conversation was the active one, resets activeConvId to null.
 */
export function deleteConversation(notebookId: string, convId: string): void {
  try {
    localStorage.removeItem(getMsgsKey(notebookId, convId))
  } catch { }

  const store = loadConversations(notebookId)
  delete store.conversations[convId]
  if (store.activeConvId === convId) {
    store.activeConvId = null
  }
  saveConversations(notebookId, store)
}

/**
 * Create a new conversation, optionally auto-titling it from a first message.
 * Sets the new conversation as active and returns its ID.
 */
export function createConversation(notebookId: string, firstMessage?: string): string {
  const convId = generateConvId()
  const store = loadConversations(notebookId)
  store.conversations[convId] = {
    title: firstMessage ? generateTitle(firstMessage) : "新对话",
    pinned: false,
    created_at: new Date().toISOString(),
  }
  store.activeConvId = convId
  saveConversations(notebookId, store)
  return convId
}

/**
 * Update the title of an existing conversation.
 */
export function updateConversationTitle(notebookId: string, convId: string, title: string): void {
  const store = loadConversations(notebookId)
  if (store.conversations[convId]) {
    store.conversations[convId].title = title
    saveConversations(notebookId, store)
  }
}

/**
 * Toggle the pinned state of a conversation. Returns the new pinned state.
 */
export function toggleConversationPin(notebookId: string, convId: string): boolean {
  const store = loadConversations(notebookId)
  if (store.conversations[convId]) {
    store.conversations[convId].pinned = !store.conversations[convId].pinned
    saveConversations(notebookId, store)
    return store.conversations[convId].pinned
  }
  return false
}

/**
 * Set the active conversation for a notebook.
 */
export function setActiveConversation(notebookId: string, convId: string | null): void {
  const store = loadConversations(notebookId)
  store.activeConvId = convId
  saveConversations(notebookId, store)
}

/**
 * Get the message count for a conversation (without loading all messages).
 */
export function getMessageCount(notebookId: string, convId: string): number {
  return loadMessages(notebookId, convId).length
}

/**
 * Convert the store's conversation entries into a sorted ConversationMeta array.
 * Pinned conversations come first, then sorted by created_at descending.
 */
export function toConversationList(store: ConversationsStore): ConversationMeta[] {
  return Object.entries(store.conversations)
    .map(([id, entry]) => ({
      id,
      title: entry.title,
      pinned: entry.pinned,
      created_at: entry.created_at,
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

/**
 * Remove all conversation data for a notebook (metadata + all message keys).
 */
export function clearAllConversations(notebookId: string): void {
  const store = loadConversations(notebookId)
  for (const convId of Object.keys(store.conversations)) {
    try {
      localStorage.removeItem(getMsgsKey(notebookId, convId))
    } catch { }
  }
  try {
    localStorage.removeItem(getMetaKey(notebookId))
  } catch { }
}
