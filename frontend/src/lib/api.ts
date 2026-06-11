import type { Notebook, Document, ChatResponse, Citation, Note, SearchResult } from "@/types"

const BASE = "/api"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

function getSettingsHeaders() {
  const headers: Record<string, string> = {}
  const llmUrl = localStorage.getItem("llm_base_url")
  const llmKey = localStorage.getItem("llm_api_key")
  const llmModel = localStorage.getItem("llm_model")
  const embedUrl = localStorage.getItem("embed_base_url")
  const embedKey = localStorage.getItem("embed_api_key")
  const embedModel = localStorage.getItem("embed_model")

  if (llmUrl) headers["X-LLM-Base-URL"] = llmUrl
  if (llmKey) headers["X-LLM-API-Key"] = llmKey
  if (llmModel) headers["X-LLM-Model"] = llmModel
  if (embedUrl) headers["X-Embed-Base-URL"] = embedUrl
  if (embedKey) headers["X-Embed-API-Key"] = embedKey
  if (embedModel) headers["X-Embed-Model"] = embedModel
  return headers
}

export const api = {
  notebooks: {
    list: () => request<Notebook[]>("/notebooks"),
    get: (id: string) => request<Notebook>(`/notebooks/${id}`),
    create: (name: string) =>
      request<Notebook>("/notebooks", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: string, data: { name?: string; tags?: string[] }) =>
      request<Notebook>(`/notebooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/notebooks/${id}`, { method: "DELETE" }),
  },

  tags: {
    list: () => request<string[]>("/tags"),
    delete: (name: string) =>
      request<{ ok: boolean; removed_from: number }>(`/tags/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
  },

  documents: {
    list: (notebookId: string) =>
      request<Document[]>(`/documents/notebook/${notebookId}`),
    upload: (notebookId: string, file: File) => {
      const form = new FormData()
      form.append("file", file)
      return fetch(`${BASE}/documents/upload?notebook_id=${notebookId}`, {
        method: "POST",
        body: form,
      }).then((r) => {
        if (!r.ok) throw new Error("Upload failed")
        return r.json() as Promise<Document>
      })
    },
    fetchUrl: (notebookId: string, url: string) =>
      request<Document>("/documents/fetch-url", {
        method: "POST",
        body: JSON.stringify({ notebook_id: notebookId, url }),
      }),
    delete: (notebookId: string, docId: string) =>
      request<void>(`/documents/${notebookId}/${docId}`, {
        method: "DELETE",
      }),
    content: (notebookId: string, docId: string) =>
      request<{ content: string }>(`/documents/${notebookId}/${docId}/content`),
  },

  chat: {
    send: (notebookId: string, message: string, topK?: number, chatHistory?: { role: string; content: string }[]) =>
      request<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ notebook_id: notebookId, message, top_k: topK, chat_history: chatHistory }),
      }),

    export: async (notebookId: string) => {
        const res = await fetch(`${BASE}/chat/export/${notebookId}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
          throw new Error(err.detail || `HTTP ${res.status}`)
        }
        const blob = await res.blob()
        const disposition = res.headers.get("Content-Disposition") || ""
        const filenameMatch = disposition.match(/filename="?(.+?)"?$/)
        const filename = filenameMatch ? filenameMatch[1].replace(/"/g, "") : `conversation_${notebookId}.md`
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      },

    stream: (
      notebookId: string,
      message: string,
      onToken: (token: string) => void,
      onCitations: (citations: Citation[]) => void,
      onDone: () => void,
      onError: (err: Error) => void,
      chatHistory?: { role: string; content: string }[],
      topK?: number,
    ) => {
      fetch(`${BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSettingsHeaders(),
        },
        body: JSON.stringify({ notebook_id: notebookId, message, top_k: topK, chat_history: chatHistory }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const reader = res.body?.getReader()
          if (!reader) throw new Error("No response body")
          const decoder = new TextDecoder()
          let buffer = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") {
                  onDone()
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.token !== undefined) {
                    onToken(parsed.token)
                  }
                  if (parsed.citations !== undefined) {
                    onCitations(parsed.citations)
                  }
                  if (parsed.error) {
                    onError(new Error(parsed.error))
                    return
                  }
                } catch {
                  // skip unparseable chunks
                }
              }
            }
          }
          onDone()
        })
        .catch((err) => onError(err))
    },
  },

  notes: {
    list: (notebookId: string) => request<Note[]>(`/notes/${notebookId}`),
    create: (notebookId: string, title: string, content: string) =>
      request<Note>("/notes", {
        method: "POST",
        body: JSON.stringify({ notebook_id: notebookId, title, content }),
      }),
    update: (noteId: string, notebookId: string, title: string, content: string) =>
      request<Note>(`/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ notebook_id: notebookId, title, content }),
      }),
    delete: (notebookId: string, noteId: string) =>
      request<void>(`/notes/${notebookId}/${noteId}`, { method: "DELETE" }),
  },

  search: (q: string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),

  health: {
    check: () => request<{
      status: string
      version: string
      embedding: { ok: boolean; mode: string; model: string; message: string; error?: string }
      llm: { ok: boolean; model: string; message: string; error?: string }
    }>("/health"),
  },
}
