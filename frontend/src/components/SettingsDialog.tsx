"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useToast } from "./Toast"

interface Props {
  onClose: () => void
}

export default function SettingsDialog({ onClose }: Props) {
  const [llmUrl, setLlmUrl] = useState(localStorage.getItem("llm_base_url") || "")
  const [llmKey, setLlmKey] = useState(localStorage.getItem("llm_api_key") || "")
  const [llmModel, setLlmModel] = useState(localStorage.getItem("llm_model") || "gpt-4o")
  const [embedUrl, setEmbedUrl] = useState(localStorage.getItem("embed_base_url") || "")
  const [embedKey, setEmbedKey] = useState(localStorage.getItem("embed_api_key") || "")
  const [embedModel, setEmbedModel] = useState(localStorage.getItem("embed_model") || "text-embedding-3-small")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const { toast } = useToast()

  function save() {
    localStorage.setItem("llm_base_url", llmUrl)
    localStorage.setItem("llm_api_key", llmKey)
    localStorage.setItem("llm_model", llmModel)
    localStorage.setItem("embed_base_url", embedUrl)
    localStorage.setItem("embed_api_key", embedKey)
    localStorage.setItem("embed_model", embedModel)
    toast("设置已保存", "success")
    onClose()
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.health.check()
      const parts: string[] = []
      parts.push(`✓ 后端服务: ${result.status}`)

      if (result.llm.ok) {
        parts.push(`✓ LLM: ${result.llm.message}`)
      } else {
        parts.push(`✗ LLM: ${result.llm.error || result.llm.message}`)
      }

      if (result.embedding.ok) {
        parts.push(`✓ 向量化: ${result.embedding.message}`)
      } else {
        parts.push(`✗ 向量化: ${result.embedding.error || result.embedding.message}`)
      }

      setTestResult(parts.join("\n"))
    } catch (e: unknown) {
      setTestResult(`✗ 无法连接到后端服务: ${(e as Error).message}`)
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface-canvas shadow-2xl w-[480px] max-h-[85vh] overflow-y-auto"
        style={{ borderRadius: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-hairline">
          <h2 className="text-apple-tagline text-ink">API 设置</h2>
          <p className="text-apple-caption text-ink-secondary mt-1">
            配置你的 LLM API，配置保存在浏览器本地存储中
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <fieldset className="border border-hairline p-4" style={{ borderRadius: 12 }}>
            <legend className="text-apple-fine font-semibold text-ink-secondary px-1">LLM 对话模型</legend>
            <div className="space-y-3">
              <div>
                <label className="text-apple-fine text-ink-secondary">接口地址</label>
                <input value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)}
                  className="input-field text-apple-fine mt-1" placeholder="https://api.openai.com/v1" />
              </div>
              <div>
                <label className="text-apple-fine text-ink-secondary">API 密钥</label>
                <input value={llmKey} onChange={(e) => setLlmKey(e.target.value)} type="password"
                  className="input-field text-apple-fine mt-1" placeholder="sk-..." />
              </div>
              <div>
                <label className="text-apple-fine text-ink-secondary">模型名称</label>
                <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)}
                  className="input-field text-apple-fine mt-1" placeholder="gpt-4o" />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-hairline p-4" style={{ borderRadius: 12 }}>
            <legend className="text-apple-fine font-semibold text-ink-secondary px-1">
              向量化模型（可选，留空则本地回退）
            </legend>
            <div className="space-y-3">
              <div>
                <label className="text-apple-fine text-ink-secondary">接口地址</label>
                <input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)}
                  className="input-field text-apple-fine mt-1" placeholder="留空则与 LLM 相同" />
              </div>
              <div>
                <label className="text-apple-fine text-ink-secondary">API 密钥</label>
                <input value={embedKey} onChange={(e) => setEmbedKey(e.target.value)} type="password"
                  className="input-field text-apple-fine mt-1" placeholder="留空则与 LLM 相同" />
              </div>
              <div>
                <label className="text-apple-fine text-ink-secondary">模型名称</label>
                <input value={embedModel} onChange={(e) => setEmbedModel(e.target.value)}
                  className="input-field text-apple-fine mt-1" placeholder="text-embedding-3-small" />
              </div>
            </div>
          </fieldset>

          {testResult && (
            <div className="p-3 border border-hairline animate-fade-in" style={{ borderRadius: 12, background: testResult.includes("✗") ? "rgba(255,59,48,0.05)" : "rgba(52,199,89,0.05)" }}>
              <pre className="text-apple-fine text-ink-secondary whitespace-pre-line">{testResult}</pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-hairline flex justify-between gap-2">
          <button onClick={testConnection} disabled={testing} className="btn-outline text-apple-caption">
            {testing ? "测试中…" : "测试连接"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-apple-caption">取消</button>
            <button onClick={save} className="btn-primary text-apple-caption !px-6 !py-2">保存</button>
          </div>
        </div>
      </div>
    </div>
  )
}
