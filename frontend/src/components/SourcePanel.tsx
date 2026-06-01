"use client"

import type { Document } from "@/types"
import UploadZone from "./UploadZone"
import { api } from "@/lib/api"
import { useToast } from "./Toast"

interface Props {
  notebookId: string
  documents: Document[]
  onRefresh: () => void
  onSelectDoc?: (doc: Document) => void
}

export default function SourcePanel({ notebookId, documents, onRefresh, onSelectDoc }: Props) {
  const { toast } = useToast()

  async function remove(id: string, filename: string) {
    if (!confirm(`确定删除 "${filename}"？`)) return
    await api.documents.delete(notebookId, id)
    toast(`已删除 "${filename}"`, "info")
    onRefresh()
  }

  const icons: Record<string, string> = {
    pdf: "\ud83d\udcc4",
    docx: "\ud83d\udcdd",
    pptx: "\ud83d\udcca",
    txt: "\ud83d\udcc3",
    markdown: "\ud83d\udccb",
    url: "\ud83c\udf10",
    html: "\ud83c\udf10",
    code: "\ud83d\udcbb",
    csv: "\ud83d\udcca",
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
          <div
            key={doc.id}
            onClick={() => onSelectDoc?.(doc)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-parchment cursor-pointer group border-b border-hairline-soft last:border-0"
          >
            <span className="text-lg">{icons[doc.file_type] || "\ud83d\udcce"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-apple-caption text-ink truncate">{doc.filename}</div>
              <div className="text-apple-fine text-ink-secondary">{doc.chunk_count} 分块</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); remove(doc.id, doc.filename) }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
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
