"use client"

import { useState, useEffect, useRef } from "react"
import { api } from "@/lib/api"
import type { Note } from "@/types"
import { useToast } from "./Toast"

interface Props {
  notebookId: string
  initialContent?: string
  onClose: () => void
}

export default function NoteEditor({ notebookId, initialContent, onClose }: Props) {
  const [title, setTitle] = useState("笔记")
  const [content, setContent] = useState(initialContent || "")
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    api.notes.list(notebookId).then(setNotes).catch(() => {
      const local = localStorage.getItem(`notes_${notebookId}`)
      if (local) {
        try { setNotes(JSON.parse(local)) } catch {}
      }
    })
  }, [notebookId])

  async function save() {
    setSaving(true)
    try {
      const note = notes.find((n) => n.id === activeId)
      let result: Note
      if (note) {
        result = await api.notes.update(note.id, notebookId, title, content)
        setNotes((prev) => prev.map((n) => (n.id === activeId ? result : n)))
      } else {
        result = await api.notes.create(notebookId, title, content)
        setActiveId(result.id)
        setNotes((prev) => [result, ...prev])
      }
      toast("笔记已保存", "success")
    } catch {
      const notesCache = JSON.parse(localStorage.getItem(`notes_${notebookId}`) || "[]")
      if (activeId) {
        const idx = notesCache.findIndex((n: Note) => n.id === activeId)
        if (idx >= 0) notesCache[idx] = { ...notesCache[idx], title, content, updated_at: new Date().toISOString() }
      } else {
        const newId = Date.now().toString()
        notesCache.unshift({ id: newId, notebook_id: notebookId, title, content, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        setActiveId(newId)
        setNotes([notesCache[0], ...notes])
      }
      localStorage.setItem(`notes_${notebookId}`, JSON.stringify(notesCache))
      toast("笔记已保存到本地", "info")
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="bg-surface-canvas shadow-2xl w-[720px] max-h-[80vh] flex flex-col" style={{ borderRadius: 18 }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-apple-body-strong bg-transparent border-none outline-none flex-1 text-ink"
            placeholder="笔记标题"
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-sm bg-primary">
              {saving ? "保存中…" : "保存"}
            </button>
            <button onClick={onClose} className="btn-sm bg-ink-muted">关闭</button>
          </div>
        </div>
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-5 text-apple-body outline-none resize-none text-ink bg-surface-canvas"
          placeholder="在此编写笔记…"
          rows={15}
          style={{ fontFamily: "inherit", lineHeight: 1.6 }}
        />
      </div>
    </div>
  )
}
