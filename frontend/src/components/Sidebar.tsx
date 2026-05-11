"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import type { Notebook } from "@/types"
import { api } from "@/lib/api"
import SettingsDialog from "./SettingsDialog"

export default function Sidebar() {
  const pathname = usePathname()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)

  const load = () => {
    api.notebooks.list().then(setNotebooks).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function create() {
    const name = window.prompt("笔记本名称：")
    if (!name?.trim()) return
    try {
      await api.notebooks.create(name.trim())
      load()
    } catch (e: unknown) {
      alert((e as Error).message)
    }
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

      <nav className="flex-1 overflow-y-auto px-2">
        {notebooks.map((nb) => {
          const active = pathname === `/notebook/${nb.id}`
          return (
            <Link
              key={nb.id}
              href={`/notebook/${nb.id}`}
              className={`flex items-center gap-2.5 px-3 py-2 mb-0.5 text-apple-caption transition-colors ${
                active
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-ink hover:bg-hairline-soft"
              }`}
              style={{ borderRadius: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="truncate">{nb.name}</span>
            </Link>
          )
        })}
        {notebooks.length === 0 && (
          <p className="px-3 py-4 text-apple-fine text-ink-secondary text-center">
            点击上方按钮创建第一个笔记本
          </p>
        )}
      </nav>

      <div className="p-3 border-t border-hairline">
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
