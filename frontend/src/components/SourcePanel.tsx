"use client"

import { useState } from "react"
import type { Document } from "@/types"
import UploadZone from "./UploadZone"
import DocumentSummary from "./DocumentSummary"
import { api } from "@/lib/api"
import { useToast } from "./Toast"

interface Props {
  notebookId: string
  documents: Document[]
  onRefresh: () => void
  onSelectDoc?: (doc: Document) => void
}

export default function SourcePanel({ notebookId, documents, onRefresh, onSelectDoc }: Props) {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
  const { toast } = useToast()

  async function remove(id: string, filename: string) {
    if (!confirm(`确定删除 "${filename}"？`)) return
    await api.documents.delete(notebookId, id)
    toast(`已删除 "${filename}"`, "info")
    onRefresh()
  }

  const icons: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    pptx: "📊",
    txt: "📃",
    markdown: "📋",
    url: "🌐",
    html: "🌐",
    code: "💻",
    csv: "📊",
  }

  return (
    <div className="card mx-4 mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
        <h3 className="text-apple-caption font-semibold text-ink">源文档</h3>
        <span className="text-apple-fine text-ink-secondary">{documents.length} 个文档</span>
      </div>
      <UploadZone notebookId={notebookId} onUploaded={onRefresh} />
      <div className="max-h-64 overflow-y-auto">
        {documents.map((doc) => (
          <div key={doc.id}>
            <div
              onClick={() => onSelectDoc?.(doc)}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-parchment cursor-pointer group border-b border-hairline-soft last:border-0"
            >
              <span className="text-lg">{icons[doc.file_type] || "📎"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-apple-caption text-ink truncate">{doc.filename}</div>
                <div className="text-apple-fine text-ink-secondary">{doc.chunk_count} 分块</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedDocId(expandedDocId === doc.id ? null : doc.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-ink-secondary/10 rounded transition-all"
                title={expandedDocId === doc.id ? "收起摘要" : "查看摘要"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`transition-transform ${expandedDocId === doc.id ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); remove(doc.id, doc.filename) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {expandedDocId === doc.id && (
              <DocumentSummary docId={doc.id} fileName={doc.filename} />
            )}
          </div>
        ))}
        {documents.length === 0 && (
          <div className="px-4 py-6 text-center text-apple-fine text-ink-secondary">
            上传 PDF、DOCX、TXT 或输入网页链接
          </div>
        )}
      </div>
    </div>
  )
}
