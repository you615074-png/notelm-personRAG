"use client"

import { useEffect, useRef } from "react"

interface ShortcutEntry {
  keys: string[]
  description: string
  scope: string
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["Ctrl", "K"], description: "打开全局搜索", scope: "全局" },
  { keys: ["Ctrl", "J"], description: "新建对话", scope: "笔记本" },
  { keys: ["Ctrl", "E"], description: "导出当前对话", scope: "笔记本" },
  { keys: ["Ctrl", "N"], description: "新建笔记本", scope: "全局" },
  { keys: ["Ctrl", ","], description: "打开设置", scope: "全局" },
  { keys: ["?"], description: "显示/隐藏快捷键帮助", scope: "全局" },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-medium
      bg-hairline-soft text-ink-secondary border border-hairline rounded
      font-mono select-none">
      {children}
    </kbd>
  )
}

interface Props {
  onClose: () => void
}

export default function ShortcutsHelpDialog({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white dark:bg-[#2c2c2e] shadow-2xl w-full max-w-md mx-4 animate-fade-in"
        style={{ borderRadius: 18 }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-hairline flex items-center justify-between">
          <h2 className="text-apple-body-strong text-ink">键盘快捷键</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-hairline-soft rounded-lg transition-colors"
            title="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Shortcut list */}
        <div className="px-4 py-3 space-y-1 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-hairline-soft transition-colors"
            >
              <div className="flex-1">
                <span className="text-apple-caption text-ink">{entry.description}</span>
                <span className="text-apple-fine text-ink-muted ml-2">{entry.scope}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entry.keys.map((key, j) => (
                  <span key={j} className="flex items-center gap-1">
                    {j > 0 && <span className="text-ink-muted text-[10px] mx-0.5">+</span>}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-hairline text-apple-fine text-ink-muted text-center">
          在输入框或文本区域中输入时，快捷键不会触发
        </div>
      </div>
    </div>
  )
}
