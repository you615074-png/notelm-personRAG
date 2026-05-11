import type { Notebook, Document, ChatResponse, Citation } from "@/types"

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

export const api = {
  notebooks: {
    list: () => request<Notebook[]>("/notebooks"),
    get: (id: string) => request<Notebook>(`/notebooks/${id}`),
    create: (name: string) =>
      request<Notebook>("/notebooks", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: string, name: string) =>
      request<Notebook>(`/notebooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) =>
      request<void>(`/notebooks/${id}`, { method: "DELETE" }),
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
  },

  chat: {
    send: (notebookId: string, message: string, topK?: number) =>
      request<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ notebook_id: notebookId, message, top_k: topK }),
      }),

    stream: (
      notebookId: string,
      message: string,
      onToken: (token: string) => void,
      onDone: () => void,
      onError: (err: Error) => void,
      topK?: number,
    ) => {
      fetch(`${BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook_id: notebookId, message, top_k: topK }),
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
                  if (parsed.token) onToken(parsed.token)
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
}
