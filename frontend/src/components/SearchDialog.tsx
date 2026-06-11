"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import type { SearchResult } from "@/types"

export default function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const router = useRouter()

  // Keep a ref for the open state so the global Escape handler is never stale
  const openRef = useRef(open)
  openRef.current = open

  // Global Ctrl+K handler — skips when focus is inside an input or textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA") return
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape" && openRef.current) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input and reset state when the dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    setQuery("")
    setResults([])
    setSelectedIndex(0)
    setLoading(false)
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await api.search(q.trim())
      setResults(data)
      setSelectedIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search — 300 ms
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (results.length > 0 && results[selectedIndex]) {
        router.push(`/notebook/${results[selectedIndex].notebook_id}`)
        setOpen(false)
      }
    }
  }

  function navigate(notebookId: string) {
    router.push(`/notebook/${notebookId}`)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog panel */}
      <div className="relative z-10 flex flex-col items-center pt-[15vh]">
        <div className="w-full max-w-xl mx-4">
          <div className="bg-white dark:bg-[#2c2c2e] rounded-xl shadow-2xl border border-hairline overflow-hidden">
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
              {loading ? (
                <svg
                  className="animate-spin shrink-0 text-ink-muted"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0 text-ink-muted"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索所有笔记本…"
                className="flex-1 bg-transparent text-apple-caption text-ink outline-none placeholder:text-ink-muted"
              />
              <kbd className="text-[11px] text-ink-muted bg-hairline-soft px-1.5 py-0.5 rounded font-mono select-none">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            {query.trim() !== "" && (
              <div className="max-h-80 overflow-y-auto">
                {loading && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-apple-fine text-ink-muted">
                    搜索中…
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-apple-caption text-ink-secondary">未找到结果</p>
                    <p className="text-apple-fine text-ink-muted mt-1">尝试其他关键词</p>
                  </div>
                )}
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(r.notebook_id)}
                    className={`w-full text-left px-4 py-3 transition-colors border-b border-hairline last:border-b-0 ${
                      i === selectedIndex ? "bg-primary/8" : "hover:bg-hairline-soft"
                    }`}
                  >
                    <p className="text-apple-caption text-ink line-clamp-2 mb-1">
                      {r.snippet}
                    </p>
                    <div className="flex items-center gap-2 text-apple-fine text-ink-muted">
                      <span className="font-medium text-ink-secondary">{r.source}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.notebook_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
