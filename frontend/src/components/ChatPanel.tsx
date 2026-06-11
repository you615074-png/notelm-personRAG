"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { ChatMessage, Citation } from "@/types"
import { api } from "@/lib/api"
import {
  loadMessages,
  saveMessages,
  createConversation,
  generateTitle,
  updateConversationTitle,
} from "@/lib/conversations"
import NoteEditor from "./NoteEditor"
import SuggestedQuestions from "./SuggestedQuestions"
import NotebookSummary from "./NotebookSummary"
import { useToast } from "./Toast"

interface Props {
  notebookId: string
  convId: string | null
  onConvCreated?: (convId: string) => void
}

function getChatHistoryForAPI(msgs: ChatMessage[], currentMsgId: string): { role: string; content: string }[] {
  return msgs
    .filter((m) => m.id !== currentMsgId)
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }))
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const renderContent = (content: string) => {
    if (!msg.citations?.length) return <span className="whitespace-pre-wrap">{content}</span>
    const parts = content.split(/(\[\d+\])/g)
    return (
      <span className="whitespace-pre-wrap">
        {parts.map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/)
          if (!m) return <span key={i}>{part}</span>
          const idx = parseInt(m[1])
          const cite = msg.citations?.find((c) => c.index === idx)
          if (!cite) return <span key={i}>{part}</span>
          return (
            <span key={i} className="relative inline">
              <sup
                className="cursor-pointer font-semibold text-[10px]"
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
        {msg.citations && msg.citations.length > 0 && msg.role === "assistant" && (
          <div className="mt-2 pt-2 border-t border-hairline-soft">
            <div className="text-apple-fine text-ink-secondary font-semibold mb-1">信息来源</div>
            {msg.citations.map((c, i) => (
              <div key={i} className="text-apple-fine text-ink-secondary mb-0.5">
                <span className="font-semibold" style={{ color: "#2997ff" }}>[{c.index}]</span>{" "}
                {c.source}{c.page ? ` p.${c.page}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPanel({ notebookId, convId, onConvCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    convId ? loadMessages(notebookId, convId) : []
  )
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCitationsRef = useRef<Citation[]>([])
  const { toast } = useToast()

  // Refs so the custom event listener always reads the latest values
  const notebookIdRef = useRef(notebookId)
  notebookIdRef.current = notebookId
  const hasMessagesRef = useRef(false)
  hasMessagesRef.current = messages.length > 0

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Guard to prevent useEffect from reloading localStorage messages
  // when a conversation was just auto-created mid-send (state already has
  // the in-flight messages and we don't want localStorage to overwrite them).
  const convAutoCreatedRef = useRef(false)

  // Reload messages when notebook or conversation changes
  useEffect(() => {
    if (convAutoCreatedRef.current) {
      convAutoCreatedRef.current = false
      return
    }
    if (convId) {
      setMessages(loadMessages(notebookId, convId))
    } else {
      setMessages([])
    }
    setInput("")
    setLoading(false)
  }, [notebookId, convId])

  useEffect(() => { scrollDown() }, [messages, scrollDown])

  // Listen for keyboard shortcut to export conversation
  useEffect(() => {
    const handler = async () => {
      if (!hasMessagesRef.current) return
      try {
        await api.chat.export(notebookIdRef.current)
        toast("对话已导出", "success")
      } catch (e) {
        toast(e instanceof Error ? e.message : "导出失败", "error")
      }
    }
    window.addEventListener("notelm:export-conversation", handler)
    return () => window.removeEventListener("notelm:export-conversation", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Ensures a conversation exists, creating one if needed. Returns the convId. */
  function ensureConvId(firstMessage?: string): string {
    if (convId) return convId
    const newId = createConversation(notebookId, firstMessage)
    convAutoCreatedRef.current = true
    onConvCreated?.(newId)
    return newId
  }

  async function send(text?: string) {
    const msgText = (text ?? input).trim()
    if (!msgText || loading) return
    if (!text) setInput("")

    const activeConvId = ensureConvId(msgText)

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msgText,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    saveMessages(notebookId, activeConvId, updatedMessages)
    setLoading(true)

    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      citations: [],
    }
    setMessages((prev) => [...prev, assistantMsg])
    pendingCitationsRef.current = []

    const chatHistory = getChatHistoryForAPI(updatedMessages, "")

    api.chat.stream(
      notebookId, msgText,
      (data) => {
        if (typeof data === "string") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + data } : m))
          )
        }
      },
      (citations) => {
        pendingCitationsRef.current = citations
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, citations } : m))
        )
      },
      () => {
        setLoading(false)
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantId && pendingCitationsRef.current.length > 0
              ? { ...m, citations: pendingCitationsRef.current }
              : m
          )
          saveMessages(notebookId, activeConvId, final)

          // Auto-update title from first user message after first exchange completes
          const userMsgs = final.filter((m) => m.role === "user")
          if (userMsgs.length === 1 && userMsgs[0].content === msgText) {
            const autoTitle = generateTitle(msgText)
            updateConversationTitle(notebookId, activeConvId, autoTitle)
          }

          return final
        })
      },
      (err) => {
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId ? { ...m, content: `错误：${err.message}` } : m
          )
          saveMessages(notebookId, activeConvId, next)
          return next
        })
        setLoading(false)
      },
      chatHistory,
    )
  }

  function handleClear() {
    setShowClearConfirm(true)
  }
  function confirmClear() {
    setMessages([])
    if (convId) {
      saveMessages(notebookId, convId, [])
    }
    setShowClearConfirm(false)
  }

  async function handleExport() {
    try {
      await api.chat.export(notebookId)
      toast("对话已导出", "success")
    } catch (e) {
      toast(e instanceof Error ? e.message : "导出失败", "error")
    }
  }

  function saveToNote(msg: ChatMessage) {
    setNoteContent(msg.content)
    setShowNoteEditor(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const hasMessages = messages.length > 0
  const showEmptyState = !hasMessages && !loading

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-3 border-b border-hairline flex items-center justify-between">
        <h3 className="text-apple-caption font-semibold text-ink">对话</h3>
        {hasMessages && (
          <div className="flex items-center gap-1">
            <button onClick={handleExport} className="text-apple-fine text-ink-secondary hover:text-primary btn-ghost p-1" title="导出对话">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button onClick={handleClear} className="text-apple-fine text-ink-secondary hover:text-red-500 btn-ghost">
              清空
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showEmptyState && (
          <div className="h-full flex flex-col items-center justify-center">
            <NotebookSummary notebookId={notebookId} />
            <SuggestedQuestions
              notebookId={notebookId}
              onSelect={(question) => send(question)}
            />
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
            onKeyDown={handleKeyDown}
            placeholder="基于你的源文档提问… (Enter 发送)"
            className="input-field flex-1 text-apple-caption"
            disabled={loading}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary shrink-0 !px-5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-surface-canvas shadow-2xl w-80 p-6 animate-fade-in" style={{ borderRadius: 18 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-apple-body-strong text-ink mb-2">清空对话？</h3>
            <p className="text-apple-caption text-ink-secondary mb-4">当前对话的所有消息将被删除，此操作不可撤销。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClearConfirm(false)} className="btn-outline text-apple-caption">取消</button>
              <button onClick={confirmClear} className="btn-sm bg-red-500">确认清空</button>
            </div>
          </div>
        </div>
      )}

      {showNoteEditor && (
        <NoteEditor notebookId={notebookId} initialContent={noteContent} onClose={() => setShowNoteEditor(false)} />
      )}
    </div>
  )
}
