"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Notebook, Document, ConversationMeta } from "@/types"
import { api } from "@/lib/api"
import {
  loadConversations,
  saveConversations,
  deleteConversation,
  createConversation,
  toggleConversationPin,
  updateConversationTitle,
  toConversationList,
  clearAllConversations,
} from "@/lib/conversations"
import SourcePanel from "@/components/SourcePanel"
import ChatPanel from "@/components/ChatPanel"
import ConversationHistory from "@/components/ConversationHistory"

export default function NotebookPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [convId, setConvId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationMeta[]>([])

  // Load conversations from localStorage, auto-select the active one
  const refreshConversations = useCallback(() => {
    const store = loadConversations(id)
    setConversations(toConversationList(store))
    setConvId(store.activeConvId)
  }, [id])

  const load = () => {
    api.notebooks.get(id).then(setNotebook).catch(() => router.push("/"))
    api.documents.list(id).then(setDocuments).catch(() => {})
    setLoading(false)
  }

  useEffect(() => {
    load()
    refreshConversations()
  }, [id])

  // Listen for keyboard shortcut to create new conversation
  useEffect(() => {
    const handler = () => handleNewConv()
    window.addEventListener("notelm:new-conversation", handler)
    return () => window.removeEventListener("notelm:new-conversation", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function rename() {
    const name = window.prompt("重命名笔记本：", notebook?.name)
    if (!name?.trim() || !notebook) return
    await api.notebooks.update(id, { name: name.trim() })
    setNotebook({ ...notebook, name: name.trim() })
  }

  async function remove() {
    if (!confirm(`确定删除“${notebook?.name}”及其所有源文档？`)) return
    await api.notebooks.delete(id)
    localStorage.removeItem(`notes_${id}`)
    clearAllConversations(id)
    router.push("/")
  }

  // --- Conversation handlers ---

  function handleSelectConv(cId: string) {
    setConvId(cId)
    const store = loadConversations(id)
    store.activeConvId = cId
    saveConversations(id, store)
  }

  function handleNewConv() {
    const newId = createConversation(id)
    setConvId(newId)
    refreshConversations()
  }

  function handleDeleteConv(cId: string) {
    deleteConversation(id, cId)
    refreshConversations()
  }

  function handleTogglePin(cId: string) {
    toggleConversationPin(id, cId)
    refreshConversations()
  }

  function handleRenameConv(cId: string, title: string) {
    updateConversationTitle(id, cId, title)
    refreshConversations()
  }

  function handleConvCreated(newId: string) {
    setConvId(newId)
    refreshConversations()
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
        <ConversationHistory
          notebookId={id}
          conversations={conversations}
          activeConvId={convId}
          onSelect={handleSelectConv}
          onNew={handleNewConv}
          onDelete={handleDeleteConv}
          onTogglePin={handleTogglePin}
          onRename={handleRenameConv}
        />
        <ChatPanel
          notebookId={id}
          convId={convId}
          onConvCreated={handleConvCreated}
        />
      </div>
    </div>
  )
}
