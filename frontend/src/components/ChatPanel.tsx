"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { ChatMessage } from "@/types"
import { api } from "@/lib/api"
import NoteEditor from "./NoteEditor"

interface Props {
  notebookId: string
}

function getStorageKey(notebookId: string) {
  return `chat_history_${notebookId}`
}

function loadMessages(notebookId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(notebookId))
    if (raw) return JSON.parse(raw) as ChatMessage[]
  } catch { }
  return []
}

function saveMessages(notebookId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(getStorageKey(notebookId), JSON.stringify(msgs))
  } catch { }
}

function clearMessages(notebookId: string) {
  try {
    localStorage.removeItem(getStorageKey(notebookId))
  } catch { }
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const renderContent = (content: string) => {
    if (!msg.citations?.length) return <span>{content}</span>
    const parts = content.split(/(\[\d+\])/g)
    return (
      <span>
        {parts.map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/)
          if (!m) return <span key={i}>{part}</span>
          const idx = parseInt(m[1])
          const cite = msg.citations?.find((c) => c.index === idx)
          if (!cite) return <span key={i}>{part}</span>
          return (
            <span key={i} className="relative inline">
              <sup
                className="text-primary-on-dark cursor-pointer font-semibold text-[10px]"
                style={{ color: "#2997ff" }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                [{idx}]
              </sup>
              {hoveredIdx === idx && (
                <div
                  className="absolute bottom-full left-0 mb-1 w-64 p-2.5 text-white text-xs rounded shadow-lg z-50"
                  style={{ background: "#1d1d1f", borderRadius: 12, boxShadow: "rgba(0,0,0,0.22) 3px 5px 30px" }}
                >
                  <div className="font-semibold mb-1">{cite.source}{cite.page ? ` (p.${cite.page})` : ""}</div>
                  <div className="opacity-70 line-clamp-3">{cite.snippet}</div>
                </div>
              )}
            </span>
          )
        })}
      </span>
    )
  }

  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 text-apple-caption leading-relaxed ${
          msg.role === "user"
            ? "bg-primary text-white"
            : "bg-surface-parchment text-ink border border-hairline"
        }`}
        style={{ borderRadius: msg.role === "user" ? "18px 18px 5px 18px" : "18px 18px 18px 5px" }}
      >
        {msg.role === "user" ? msg.content : renderContent(msg.content)}
      </div>
    </div>
  )
}

export default function ChatPanel({ notebookId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(notebookId))
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => { scrollDown() }, [messages, scrollDown])
  useEffect(() => { setMessages(loadMessages(notebookId)) }, [notebookId])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => {
      const next = [...prev, userMsg]
      saveMessages(notebookId, next)
      return next
    })
    setLoading(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString(), citations: [] },
    ])

    api.chat.stream(
      notebookId, text,
      (token) => setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
      ),
      () => {
        setLoading(false)
        setMessages((prev) => { saveMessages(notebookId, prev); return prev })
      },
      (err) => {
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId ? { ...m, content: `错误：${err.message}` } : m
          )
          saveMessages(notebookId, next)
          return next
        })
        setLoading(false)
      },
    )
  }

  function handleClear() {
    setMessages([])
    clearMessages(notebookId)
  }

  function saveToNote(msg: ChatMessage) {
    setNoteContent(msg.content)
    setShowNoteEditor(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-3 border-b border-hairline flex items-center justify-between">
        <h3 className="text-apple-caption font-semibold text-ink">对话</h3>
        {messages.length > 0 && (
          <button onClick={handleClear} className="text-apple-fine text-ink-secondary hover:text-ink btn-ghost">
            清空
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-apple-caption text-ink-secondary">
            基于你的源文档提问
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="group relative">
            <MessageBubble msg={msg} />
            {msg.role === "assistant" && msg.content && !loading && (
              <button
                onClick={() => saveToNote(msg)}
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-1.5 bg-surface-canvas border border-hairline rounded-full shadow-sm transition-all"
                title="保存到笔记"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 3h10l4 4v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="#0066cc" strokeWidth="1.5" />
                  <path d="M12 8v8M8 12h8" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-1.5 px-4 py-2">
            <div className="w-2 h-2 bg-ink-secondary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-ink-secondary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-ink-secondary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-hairline">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="基于你的源文档提问…"
            className="input-field flex-1 text-apple-caption"
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary shrink-0 !px-5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {showNoteEditor && (
        <NoteEditor notebookId={notebookId} initialContent={noteContent} onClose={() => setShowNoteEditor(false)} />
      )}
    </div>
  )
}
