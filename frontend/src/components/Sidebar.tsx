"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Notebook } from "@/types"
import { api } from "@/lib/api"
import SettingsDialog from "./SettingsDialog"
import { useTheme } from "./ThemeProvider"
import { useToast } from "./Toast"

const TAG_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-700/40" },
  { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-700/40" },
  { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-700/40" },
  { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-700/40" },
  { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-700/40" },
  { bg: "bg-cyan-50 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-700/40" },
  { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-700/40" },
  { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-700/40" },
]

function getTagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

function safeError(e: unknown): string {
  return e instanceof Error ? e.message : "操作失败"
}

export default function Sidebar() {
  const pathname = usePathname()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [tagDropdownIndex, setTagDropdownIndex] = useState(-1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { dark, toggle: toggleTheme } = useTheme()
  const { toast } = useToast()
  const tagInputRef = useRef<HTMLInputElement>(null)
  const pendingSuggestionRef = useRef(false)
  const [contextMenuFor, setContextMenuFor] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    api.notebooks.list().then(setNotebooks).catch((e) => console.error("Failed to load notebooks:", e))
    api.tags.list().then(setAllTags).catch((e) => console.error("Failed to load tags:", e))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handleFocus = () => load()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [load])

  useEffect(() => {
    if (addingTagFor && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [addingTagFor])

  useEffect(() => {
    if (!contextMenuFor) return
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuFor(null)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [contextMenuFor])

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return []
    const q = tagInput.toLowerCase().trim()
    return allTags
      .filter((t) => t.toLowerCase().includes(q) && t.toLowerCase() !== q)
      .slice(0, 6)
  }, [tagInput, allTags])

  const filteredNotebooks = useMemo(() => {
    if (!tagFilter) return notebooks
    return notebooks.filter((nb) => nb.tags.includes(tagFilter))
  }, [notebooks, tagFilter])

  async function create() {
    const name = window.prompt("笔记本名称：")
    if (!name?.trim()) return
    try {
      await api.notebooks.create(name.trim())
      load()
      toast(`笔记本 "${name.trim()}" 已创建`, "success")
    } catch (e: unknown) {
      toast(safeError(e), "error")
    }
  }

  async function addTag(notebookId: string, tag?: string) {
    const resolved = (tag ?? tagInput).trim()
    if (!resolved) {
      setAddingTagFor(null)
      setTagInput("")
      setTagDropdownIndex(-1)
      return
    }
    const notebook = notebooks.find((n) => n.id === notebookId)
    if (!notebook) return
    if (notebook.tags.includes(resolved)) {
      setAddingTagFor(null)
      setTagInput("")
      setTagDropdownIndex(-1)
      return
    }
    const newTags = [...notebook.tags, resolved]
    try {
      await api.notebooks.update(notebookId, { tags: newTags })
      load()
    } catch (e: unknown) {
      toast(safeError(e), "error")
    }
    setAddingTagFor(null)
    setTagInput("")
    setTagDropdownIndex(-1)
  }

  async function removeTag(notebookId: string, tag: string) {
    const notebook = notebooks.find((n) => n.id === notebookId)
    if (!notebook) return
    const newTags = notebook.tags.filter((t) => t !== tag)
    try {
      await api.notebooks.update(notebookId, { tags: newTags })
      if (tagFilter === tag) {
        setTagFilter(null)
      }
      load()
    } catch (e: unknown) {
      toast(safeError(e), "error")
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setTagDropdownIndex((prev) => Math.min(prev + 1, tagSuggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setTagDropdownIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (tagDropdownIndex >= 0 && tagSuggestions[tagDropdownIndex] && addingTagFor) {
        const tag = tagSuggestions[tagDropdownIndex]
        setTagInput(tag)
        addTag(addingTagFor, tag)
      } else if (addingTagFor) {
        addTag(addingTagFor)
      }
    } else if (e.key === "Escape") {
      setAddingTagFor(null)
      setTagInput("")
      setTagDropdownIndex(-1)
    }
  }

  function startAddTag(notebookId: string) {
    setAddingTagFor(notebookId)
    setTagInput("")
    setTagDropdownIndex(-1)
    pendingSuggestionRef.current = false
  }

  async function handleExportNotebook(id: string) {
    try {
      await api.notebooks.export(id)
      toast("笔记本已导出", "success")
    } catch (e: unknown) {
      toast(safeError(e), "error")
    }
    setContextMenuFor(null)
  }

  function handleTagInputBlur(notebookId: string) {
    setTimeout(() => {
      if (pendingSuggestionRef.current) {
        pendingSuggestionRef.current = false
        return
      }
      if (addingTagFor === notebookId) {
        addTag(notebookId)
      }
    }, 150)
  }

  return (
    <aside className="w-60 h-full bg-surface-parchment border-r border-hairline flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-apple-tagline text-ink">Notelm</h1>
        <p className="text-apple-fine text-ink-secondary mt-0.5">个人知识库</p>
      </div>

      <div className="px-3 mb-2">
        <button
          onClick={create}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-apple-caption font-semibold text-primary hover:bg-primary/5 transition-colors"
          style={{ borderRadius: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          新建笔记本
        </button>
      </div>

      {/* Tag filter bar */}
      {tagFilter && (
        <div className="px-3 mb-1">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/6 border border-primary/20 rounded-lg">
            <span className="text-apple-fine text-primary font-medium">
              标签: {tagFilter}
            </span>
            <span className="text-apple-fine text-ink-muted">
              ({filteredNotebooks.length})
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setTagFilter(null)}
              className="text-ink-muted hover:text-ink transition-colors p-0.5"
              title="清除筛选"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2">
        {filteredNotebooks.map((nb) => {
          const active = pathname === `/notebook/${nb.id}`
          const isAddingTag = addingTagFor === nb.id
          return (
            <div key={nb.id} className="mb-0.5">
              <div className="flex items-center relative group">
                <Link
                  href={`/notebook/${nb.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 text-apple-caption transition-colors flex-1 min-w-0 ${
                    active
                      ? "bg-primary/8 text-primary font-semibold"
                      : "text-ink hover:bg-hairline-soft"
                  }`}
                  style={{ borderRadius: 8 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="truncate">{nb.name}</span>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenuFor(contextMenuFor === nb.id ? null : nb.id)
                  }}
                  className={`shrink-0 mr-1 p-1 text-ink-muted hover:text-ink hover:bg-hairline-soft transition-colors rounded-md ${
                    contextMenuFor === nb.id ? "bg-hairline-soft text-ink" : ""
                  }`}
                  title="笔记本操作"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="3" r="1.25" fill="currentColor" />
                    <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                    <circle cx="8" cy="13" r="1.25" fill="currentColor" />
                  </svg>
                </button>
                {contextMenuFor === nb.id && (
                  <div
                    ref={contextMenuRef}
                    className="absolute right-1 top-full mt-0.5 z-30 bg-white dark:bg-[#2c2c2e]
                      border border-hairline rounded-lg shadow-lg overflow-hidden min-w-[140px] py-1"
                  >
                    <button
                      onClick={() => handleExportNotebook(nb.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-apple-fine text-ink
                        hover:bg-hairline-soft transition-colors text-left"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      导出笔记本
                    </button>
                  </div>
                )}
              </div>

              {/* Tag chips */}
              <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
                {nb.tags.map((tag) => {
                  const palette = getTagColor(tag)
                  const isFiltered = tagFilter === tag
                  return (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(isFiltered ? null : tag)}
                      className={`inline-flex items-center gap-0.5 text-[11px] font-medium
                        px-1.5 py-0.5 rounded-full border cursor-pointer
                        transition-colors select-none
                        ${palette.bg} ${palette.text} ${palette.border}
                        ${isFiltered ? "ring-1 ring-primary/50" : "hover:brightness-95 dark:hover:brightness-110"}`}
                      title={isFiltered ? "清除此标签筛选" : `筛选标签: ${tag}`}
                    >
                      {tag}
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(nb.id, tag)
                        }}
                        className="ml-0.5 hover:opacity-70 transition-opacity inline-flex items-center"
                        role="button"
                        tabIndex={-1}
                        aria-label={`移除标签 ${tag}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                    </button>
                  )
                })}

                {/* Add tag button / input */}
                {isAddingTag ? (
                  <span className="relative inline-flex">
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value)
                        setTagDropdownIndex(-1)
                      }}
                      onKeyDown={handleTagKeyDown}
                      onBlur={() => handleTagInputBlur(nb.id)}
                      placeholder="添加标签…"
                      className="w-20 text-[11px] px-1.5 py-0.5 rounded-full border border-hairline
                        bg-surface-canvas dark:bg-surface-canvas text-ink
                        outline-none focus:border-primary focus:ring-1 focus:ring-primary/30
                        placeholder:text-ink-muted"
                      role="combobox"
                      aria-expanded={tagSuggestions.length > 0}
                      aria-label="添加标签"
                    />
                    {/* Autocomplete dropdown */}
                    {tagSuggestions.length > 0 && (
                      <span className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#3a3a3c]
                        border border-hairline rounded-lg shadow-lg overflow-hidden
                        min-w-[120px]">
                        {tagSuggestions.map((s, i) => (
                          <button
                            key={s}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              pendingSuggestionRef.current = true
                              setTagInput(s)
                              addTag(nb.id, s)
                            }}
                            className={`block w-full text-left px-3 py-1.5 text-[12px] text-ink
                              ${i === tagDropdownIndex ? "bg-primary/10 text-primary" : "hover:bg-hairline-soft"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      startAddTag(nb.id)
                    }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full
                      text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="添加标签"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty states */}
        {notebooks.length === 0 && (
          <p className="px-3 py-4 text-apple-fine text-ink-secondary text-center">
            点击上方按钮创建第一个笔记本
          </p>
        )}
        {notebooks.length > 0 && tagFilter && filteredNotebooks.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-apple-caption text-ink-secondary mb-2">
              没有笔记本包含标签 "{tagFilter}"
            </p>
            <button
              onClick={() => setTagFilter(null)}
              className="text-apple-fine text-primary hover:underline"
            >
              显示全部笔记本
            </button>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-hairline space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2 text-apple-caption text-ink-secondary hover:bg-hairline-soft transition-colors"
          style={{ borderRadius: 8 }}
        >
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {dark ? "浅色模式" : "深色模式"}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-apple-caption text-ink-secondary hover:bg-hairline-soft transition-colors"
          style={{ borderRadius: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          设置
        </button>
      </div>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </aside>
  )
}
