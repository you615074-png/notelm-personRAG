import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import SearchDialog from "@/components/SearchDialog"
import { ToastProvider } from "@/components/Toast"
import { ThemeProvider } from "@/components/ThemeProvider"

export const metadata: Metadata = {
  title: "Notelm — Personal RAG Notebook",
  description: "A local personal RAG app inspired by NotebookLM",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <div className="app-root flex h-full">
              <Sidebar />
              <main className="flex-1 min-w-0">{children}</main>
              <SearchDialog />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
