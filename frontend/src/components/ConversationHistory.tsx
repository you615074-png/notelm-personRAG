"use client"

import { useState, useCallback } from "react"
import type { ConversationMeta } from "@/types"
import { getMessageCount } from "@/lib/conversations"

interface Props {
  notebookId: string
  conversations: ConversationMeta[]
  activeConvId: string | null
  onSelect: (convId: string) => void
  onNew: () => void
  onDelete: (convId: string) => void
  onTogglePin: (convId: string) => void
  onRename: (convId: string, title: string) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (isToday) {
    const h = d.getHours().toString().padStart(2, "0")
    const m = d.getMinutes().toString().padStart(2, "0")
    return `${h}:${m}`
  }
  if (d.getFullYear() === now.getFullYear()) {
    const mo = (d.getMonth() + 1).toString().padStart(2, "0")
    const day = d.getDate().toString().padStart(2, "0")
    return `${mo}/${day}`
  }
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`
}

export default function ConversationHistory({
  notebookId,
  conversations,
  activeConvId,
  onSelect,
  onNew,
  onDelete,
  onTogglePin,
  onRename,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleDeleteClick = useCallback((e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    setDeleteTarget(convId)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      onDelete(deleteTarget)
      setDeleteTarget(null)
    }
  }, [deleteTarget, onDelete])

  const startRename = useCallback((e: React.MouseEvent, conv: ConversationMeta) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }, [])

  const commitRename = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle("")
  }, [editingId, editTitle, onRename])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        commitRename()
      } else if (e.key === "Escape") {
        setEditingId(null)
        setEditTitle("")
      }
    },
    [commitRename]
  )

  return (
    <div className="w-56 border-r border-hairline flex flex-col shrink-0 bg-surface-parchment">
      {/* Header */}
      <div className="px-3 py-3 border-b border-hairline flex items-center justify-between">
        <h3 className="text-apple-fine font-semibold text-ink">对话历史</h3>
        <button
          onClick={onNew}
          className="p-1 hover:bg-hairline-soft rounded-md transition-colors"
          title="新建对话"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-3 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-ink-secondary/30 mb-2"
            >
              <path
                d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-apple-fine text-ink-secondary">暂无对话</p>
            <p className="text-apple-fine text-ink-secondary/60 mt-1">
              发送消息开始新对话
            </p>
          </div>
        )}

        {conversations.map((conv) => {
          const isActive = conv.id === activeConvId
          const isEditing = editingId === conv.id
          const msgCount = getMessageCount(notebookId, conv.id)

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative px-3 py-2.5 cursor-pointer transition-colors border-b border-hairline-soft ${
                isActive
                  ? "bg-primary/8 border-l-[3px] border-l-primary"
                  : "border-l-[3px] border-l-transparent hover:bg-hairline-soft/50"
              }`}
            >
              {/* Title row */}
              <div className="flex items-center gap-1 min-w-0">
                {isEditing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    className="input-field text-apple-fine flex-1 min-w-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={`text-apple-fine truncate flex-1 ${
                      isActive ? "text-primary font-medium" : "text-ink"
                    }`}
                    title={conv.title}
                  >
                    {conv.title}
                  </span>
                )}

                {/* Pin indicator */}
                {conv.pinned && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-ink-secondary/50 shrink-0"
                  >
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-apple-fine text-ink-secondary/60">
                  {formatDate(conv.created_at)}
                </span>
                <span className="text-apple-fine text-ink-secondary/40">
                  {msgCount} 条消息
                </span>
              </div>

              {/* Action buttons — shown on hover or when pinned */}
              {(hoveredId === conv.id || conv.pinned) && !isEditing && (
                <div className="absolute top-2 right-2 flex items-center gap-0.5">
                  {/* Pin toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePin(conv.id)
                    }}
                    className={`p-0.5 rounded transition-colors ${
                      conv.pinned
                        ? "text-primary"
                        : "text-ink-secondary/40 hover:text-ink-secondary"
                    }`}
                    title={conv.pinned ? "取消置顶" : "置顶"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                  </button>

                  {/* Rename */}
                  <button
                    onClick={(e) => startRename(e, conv)}
                    className="p-0.5 rounded text-ink-secondary/40 hover:text-ink-secondary transition-colors"
                    title="重命名"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDeleteClick(e, conv.id)}
                    className="p-0.5 rounded text-ink-secondary/40 hover:text-red-500 transition-colors"
                    title="删除对话"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-surface-canvas shadow-2xl w-80 p-6 animate-fade-in"
            style={{ borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-apple-body-strong text-ink mb-2">删除对话？</h3>
            <p className="text-apple-caption text-ink-secondary mb-4">
              该对话及其所有消息将被永久删除，此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-outline text-apple-caption"
              >
                取消
              </button>
              <button onClick={confirmDelete} className="btn-sm bg-red-500">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
