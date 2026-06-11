"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

interface Props {
  notebookId: string
  onSelect: (question: string) => void
}

export default function SuggestedQuestions({ notebookId, onSelect }: Props) {
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuestions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const res = await api.chat.suggestedQuestions(notebookId, 4)
      setQuestions(res.questions)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
      if (!isRefresh) setQuestions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [notebookId])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <div className="h-9 bg-ink-secondary/10 rounded-lg animate-pulse" />
          <div className="h-9 bg-ink-secondary/10 rounded-lg animate-pulse" style={{ width: "85%" }} />
          <div className="h-9 bg-ink-secondary/10 rounded-lg animate-pulse" style={{ width: "70%" }} />
          <div className="h-9 bg-ink-secondary/10 rounded-lg animate-pulse" style={{ width: "90%" }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <span className="text-apple-caption text-ink-secondary">{error}</span>
        <button onClick={() => fetchQuestions()} className="text-apple-caption text-primary hover:underline">
          重试
        </button>
      </div>
    )
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-apple-fine text-ink-secondary font-medium">试试这些问题</span>
        <button
          onClick={() => fetchQuestions(true)}
          className="p-1 text-ink-secondary hover:text-primary transition-colors"
          title="换一换"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="px-3.5 py-2 text-apple-caption text-ink-secondary bg-surface-canvas border border-hairline rounded-full hover:border-primary hover:text-primary transition-colors text-left"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
