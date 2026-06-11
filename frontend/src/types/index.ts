export interface Notebook {
  id: string
  name: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  notebook_id: string
  filename: string
  file_type: string
  chunk_count: number
  created_at: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  timestamp: string
  title?: string | null
  pinned?: boolean
}

export interface Citation {
  index: number
  source: string
  page?: number | null
  snippet: string
}

export interface ChatResponse {
  answer: string
  citations: Citation[]
}

export interface Note {
  id: string
  notebook_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface ConversationMeta {
  id: string
  title: string
  pinned: boolean
  created_at: string
}

export interface SearchResult {
  snippet: string
  source: string
  notebook_id: string
  notebook_name: string
}
