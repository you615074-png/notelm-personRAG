"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

type ToastType = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  let nextId = 0

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const colors: Record<ToastType, string> = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-ink-muted",
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${colors[t.type]} text-white px-4 py-2.5 text-apple-caption rounded-lg shadow-lg animate-slide-up`}
            style={{ borderRadius: 12, minWidth: 200 }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
