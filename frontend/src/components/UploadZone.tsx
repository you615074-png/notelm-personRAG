"use client"

import { useState, useRef } from "react"
import { api } from "@/lib/api"
import { useToast } from "./Toast"

interface Props {
  notebookId: string
  onUploaded: () => void
}

export default function UploadZone({ notebookId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [url, setUrl] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFile(file: File) {
    setUploading(true)
    try {
      await api.documents.upload(notebookId, file)
      toast(`"${file.name}" 上传成功`, "success")
      onUploaded()
    } catch (e: unknown) {
      toast("上传失败：" + (e as Error).message, "error")
    }
    setUploading(false)
  }

  async function handleUrl() {
    if (!url.trim()) return
    setUploading(true)
    try {
      await api.documents.fetchUrl(notebookId, url.trim())
      toast("网页抓取成功", "success")
      setUrl("")
      setUrlMode(false)
      onUploaded()
    } catch (e: unknown) {
      toast("抓取失败：" + (e as Error).message, "error")
    }
    setUploading(false)
  }

  return (
    <div className="px-4 py-3">
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setUrlMode(false)}
          className={`text-apple-fine font-semibold px-4 py-1.5 transition-all duration-150 ${
            !urlMode
              ? "bg-primary text-white"
              : "bg-transparent text-ink-secondary border border-hairline hover:bg-hairline-soft"
          }`}
          style={{ borderRadius: 980 }}
        >
          文件
        </button>
        <button
          onClick={() => setUrlMode(true)}
          className={`text-apple-fine font-semibold px-4 py-1.5 transition-all duration-150 ${
            urlMode
              ? "bg-primary text-white"
              : "bg-transparent text-ink-secondary border border-hairline hover:bg-hairline-soft"
          }`}
          style={{ borderRadius: 980 }}
        >
          链接
        </button>
      </div>

      {!urlMode ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed p-3 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-primary bg-primary/4"
              : "border-hairline hover:border-primary/30"
          }`}
          style={{ borderRadius: 12 }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.mdx,.docx,.pptx,.py,.js,.ts,.tsx,.jsx,.json,.yaml,.yml,.html,.css,.csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {uploading ? (
            <span className="text-apple-fine text-ink-secondary">上传中…</span>
          ) : (
            <span className="text-apple-fine text-ink-secondary">拖拽文件到此处或点击浏览</span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="input-field !h-9 !text-apple-fine"
            onKeyDown={(e) => e.key === "Enter" && handleUrl()}
          />
          <button
            onClick={handleUrl}
            disabled={uploading}
            className="btn-sm bg-primary shrink-0"
          >
            {uploading ? "..." : "抓取"}
          </button>
        </div>
      )}
    </div>
  )
}
