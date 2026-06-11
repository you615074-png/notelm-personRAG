"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

interface Props {
  notebookId: string
}

export default function NotebookSummary({ notebookId }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const fetchSummary = useCallback(async (isRegenerate = false) => {
    if (isRegenerate) {
      setRegenerating(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await api.summaries.notebook(notebookId)
      setSummary(res.summary)
      setCached(res.cached && !isRegenerate)
      setGenerated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成摘要失败")
      if (!isRegenerate) setSummary(null)
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }, [notebookId])

  if (loading) {
    return (
      <div className="card mx-6 mb-4">
        <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h4 className="text-apple-caption font-semibold text-ink">正在生成笔记本摘要…</h4>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" />
          <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" style={{ width: "90%" }} />
          <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" style={{ width: "75%" }} />
          <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" style={{ width: "85%" }} />
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="card mx-6 mb-4">
        <div className="px-4 py-3 border-b border-hairline">
          <h4 className="text-apple-caption font-semibold text-ink">笔记本摘要</h4>
        </div>
        <div className="px-4 py-4 flex flex-col items-center gap-2">
          <span className="text-apple-caption text-red-500">{error}</span>
          <button onClick={() => fetchSummary()} className="text-apple-caption text-primary hover:underline">
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!generated) {
    return (
      <div className="card mx-6 mb-4">
        <div className="px-4 py-3 border-b border-hairline">
          <h4 className="text-apple-caption font-semibold text-ink">笔记本摘要</h4>
        </div>
        <div className="px-4 py-4">
          <button
            onClick={() => fetchSummary()}
            className="flex items-center gap-1.5 text-apple-caption text-primary hover:underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            生成摘要
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card mx-6 mb-4">
      <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h4 className="text-apple-caption font-semibold text-ink">笔记本摘要</h4>
          {cached && (
            <span className="text-[10px] px-1.5 py-0.5 bg-ink-secondary/10 text-ink-secondary rounded-full">
              已缓存
            </span>
          )}
        </div>
        <button
          onClick={() => fetchSummary(true)}
          disabled={regenerating}
          className="flex items-center gap-1 text-apple-fine text-ink-secondary hover:text-primary transition-colors disabled:opacity-50"
          title="重新生成"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            className={regenerating ? "animate-spin" : ""}
          >
            <path
              d="M1 4v6h6M23 20v-6h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {regenerating ? "生成中…" : "重新生成"}
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-apple-caption text-ink-secondary leading-relaxed whitespace-pre-line">
          {summary}
        </p>
      </div>
    </div>
  )
}
