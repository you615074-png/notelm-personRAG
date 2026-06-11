"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

interface Props {
  docId: string
  fileName: string
}

export default function DocumentSummary({ docId, fileName }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const fetchSummary = useCallback(async (isRegenerate = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.summaries.document(docId)
      setSummary(res.summary)
      setCached(res.cached && !isRegenerate)
      setGenerated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成摘要失败")
      if (!isRegenerate) setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [docId])

  if (loading) {
    return (
      <div className="px-4 py-3 bg-surface-parchment/50 border-t border-hairline-soft">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-apple-fine text-ink-secondary">正在生成摘要…</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" />
            <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" style={{ width: "85%" }} />
            <div className="h-3 bg-ink-secondary/10 rounded animate-pulse" style={{ width: "70%" }} />
          </div>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="px-4 py-3 bg-surface-parchment/50 border-t border-hairline-soft">
        <div className="flex items-center justify-between">
          <span className="text-apple-fine text-red-500">{error}</span>
          <button onClick={() => fetchSummary()} className="text-apple-fine text-primary hover:underline">
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!generated) {
    return (
      <div className="px-4 py-3 bg-surface-parchment/50 border-t border-hairline-soft">
        <button
          onClick={() => fetchSummary()}
          className="flex items-center gap-1.5 text-apple-fine text-primary hover:underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          生成摘要
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 bg-surface-parchment/50 border-t border-hairline-soft">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-apple-fine text-ink-secondary font-medium">文档摘要</span>
          {cached && (
            <span className="text-[10px] px-1.5 py-0.5 bg-ink-secondary/10 text-ink-secondary rounded-full">
              已缓存
            </span>
          )}
        </div>
        <button
          onClick={() => fetchSummary(true)}
          className="p-0.5 text-ink-secondary hover:text-primary transition-colors"
          title="重新生成"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
        </button>
      </div>
      <p className="text-apple-caption text-ink-secondary leading-relaxed whitespace-pre-line">
        {summary}
      </p>
    </div>
  )
}
