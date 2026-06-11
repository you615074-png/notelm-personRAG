"use client"

import { useState, useEffect, useRef } from "react"
import ShortcutsHelpDialog from "./ShortcutsHelpDialog"

/**
 * KeyboardShortcuts — central global keyboard shortcut handler.
 *
 * Renders in the root layout so shortcuts are always active.  Dispatches
 * CustomEvents so that page- or component-specific actions (new conversation,
 * export) can be handled by whoever is mounted at the time.
 *
 * Ctrl+K is intentionally NOT handled here — SearchDialog manages its own
 * listener with the same focus-guard logic.
 */
export default function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)

  // Ref for help dialog open state to avoid stale closures in the global listener
  const helpOpenRef = useRef(false)
  helpOpenRef.current = showHelp

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when the user is typing inside a text input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+J — new conversation (notebook-specific)
      if (ctrl && e.key === "j") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("notelm:new-conversation"))
        return
      }

      // Ctrl+E — export current conversation (notebook-specific)
      if (ctrl && e.key === "e") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("notelm:export-conversation"))
        return
      }

      // Ctrl+N — new notebook
      if (ctrl && e.key === "n") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("notelm:new-notebook"))
        return
      }

      // Ctrl+, — open settings
      if (ctrl && e.key === ",") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("notelm:open-settings"))
        return
      }

      // ? — toggle shortcuts help dialog
      if (e.key === "?") {
        e.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }

      // Escape — close help dialog if open
      if (e.key === "Escape" && helpOpenRef.current) {
        setShowHelp(false)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return showHelp ? <ShortcutsHelpDialog onClose={() => setShowHelp(false)} /> : null
}
