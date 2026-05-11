"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Notebook, Document } from "@/types"
import { api } from "@/lib/api"
import SourcePanel from "@/components/SourcePanel"
import ChatPanel from "@/components/ChatPanel"

export default function NotebookPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api.notebooks.get(id).then(setNotebook).catch(() => router.push("/"))
    api.documents.list(id).then(setDocuments).catch(() => {})
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function rename() {
    const name = window.prompt("重命名笔记本：", notebook?.name)
    if (!name?.trim() || !notebook) return
    await api.notebooks.update(id, name.trim())
    setNotebook({ ...notebook, name: name.trim() })
  }

  async function remove() {
    if (!confirm(`确定删除\u201c${notebook?.name}\u201d及其所有源文档？`)) return
    await api.notebooks.delete(id)
    localStorage.removeItem(`chat_history_${id}`)
    localStorage.removeItem(`notes_${id}`)
    router.push("/")
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center text-apple-caption text-ink-secondary">加载中…</div>
  }
  if (!notebook) {
    return <div className="h-full flex items-center justify-center text-apple-caption text-ink-secondary">笔记本未找到</div>
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-3 border-b border-hairline flex items-center justify-between shrink-0 bg-surface-canvas">
        <div className="flex items-center gap-2">
          <h2 className="text-apple-tagline text-ink">{notebook.name}</h2>
          <button onClick={rename} className="p-1 hover:bg-hairline-soft rounded-md transition-colors" title="重命名">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke="#7a7a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="#7a7a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <button onClick={remove} className="text-apple-fine text-red-500 hover:text-red-600 btn-ghost">
          删除
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-72 border-r border-hairline flex flex-col py-4 shrink-0 overflow-y-auto bg-surface-parchment">
          <SourcePanel notebookId={id} documents={documents} onRefresh={load} />
        </div>
        <ChatPanel notebookId={id} />
      </div>
    </div>
  )
}
