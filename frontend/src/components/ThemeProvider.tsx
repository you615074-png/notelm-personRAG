"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

type ThemeContextValue = {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const isDark = stored === "dark" || (!stored && prefersDark)
    setDark(isDark)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark")
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark, mounted])

  const toggle = () => setDark((d) => !d)

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
