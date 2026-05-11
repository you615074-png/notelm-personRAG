import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"

export const metadata: Metadata = {
  title: "Notelm — Personal RAG Notebook",
  description: "A local personal RAG app inspired by NotebookLM",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-root flex h-full">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  )
}
