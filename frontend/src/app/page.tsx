export default function HomePage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <div className="w-16 h-16 mb-5 flex items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #0066cc 0%, #2997ff 100%)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.5" />
          <path d="M7 8h4M7 12h6M7 16h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-apple-tagline text-ink mb-2">欢迎使用 Notelm</h1>
      <p className="text-apple-caption text-ink-secondary max-w-md leading-relaxed">
        你的个人 RAG 知识库。创建笔记本、上传文档（PDF、Word、PPT、网页），向 AI 提问你的资料内容，回答自动标注引用来源。
      </p>
      <p className="text-apple-fine text-ink-secondary/70 mt-5">
        点击侧边栏的<span className="font-semibold text-ink-secondary">"新建笔记本"</span>开始使用
      </p>
    </div>
  )
}
