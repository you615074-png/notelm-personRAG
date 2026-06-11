# Notelm — 本地个人 RAG 研究笔记

一个运行在本地的个人 RAG（检索增强生成）应用，界面和工作模式参考 Google NotebookLM。上传文档 → 自动解析 → 智能检索 → AI 基于你的资料回答问题并标注引用来源。

> **v2.0.0 更新**: 新增标签系统、全局搜索 (⌘K)、对话/笔记本导出、AI 建议问题、文档/笔记本摘要、对话历史与自动标题、键盘快捷键、AI 功能开关等 18 项重大功能，达到 NotebookLM 80%+ 使用体验。

---

## 作用

Notelm 是一个**完全本地化**的知识库对话工具。你将文档（PDF、Word、PPT、网页等）上传到笔记本后，可以直接向 AI 提问文档中的内容。AI 的回答**严格基于你提供的资料**，并逐条标注引用来源，避免幻觉。

### 典型场景

| 场景 | 用法 |
|------|------|
| **论文研读** | 上传多篇论文 PDF，交叉提问研究方法和结论 |
| **合同审查** | 上传合同文档，询问关键条款和风险点 |
| **技术文档查阅** | 上传项目文档和 API 手册，快速定位信息 |
| **调研报告** | 抓取多篇网页文章，汇总观点并对比 |
| **学习笔记** | 上传教材/课件，逐章提问巩固理解 |
| **代码审查** | 上传代码库，按函数边界智能分块，精准检索 |

---

## 核心功能

| 功能 | 说明 |
|------|------|
| **多格式文档上传** | 支持 PDF、DOCX、PPTX、TXT、Markdown、代码文件、CSV、网页抓取 |
| **自动文件类型识别** | 根据扩展名自动选择解析器，无需手动选择 |
| **智能分块** | Markdown 按标题层级分块（嵌入结构上下文）、代码按函数边界分块、通用文本滑动窗口分块 |
| **向量检索 (RAG)** | ChromaDB 存储向量，语义相似度检索 top-K 相关段落 |
| **HyDE 查询扩展** ⭐ | 自动生成假设文档嵌入，大幅提升检索命中率（可配置关闭） |
| **多轮对话上下文** ⭐ | AI 记住对话历史，支持连续追问和深入讨论 |
| **AI 对话** | 基于检索结果构建上下文，LLM 生成带引用的回答 |
| **流式输出 (SSE)** | 回答逐字返回，边生成边显示，引用标注实时出现 |
| **引用标注** ⭐ | 流式对话中也支持引用标注，hover 可查看来源原文片段 |
| **对话持久化** | 刷新/关闭页面后对话历史保留在本地 (localStorage) |
| **笔记本管理** | 创建/重命名/删除笔记本，每个笔记本独立隔离文档和对话 |
| **笔记编辑器** | 聊天对话一键保存为笔记，关联到当前笔记本，支持服务端持久化 |
| **深色模式** ⭐ | 支持浅色/深色模式切换，自动跟随系统偏好 |
| **本地 Embedding 回退** | 若 Embedding API 不可用，自动使用 `all-MiniLM-L6-v2` 本地模型（模型缓存，首次后瞬加载） |
| **API 设置面板** | 前端 Settings 弹窗修改 API 地址/密钥/模型，支持一键测试连接 |
| **重复文档检测** ⭐ | 上传同名文件或相同 URL 时自动拦截，避免浪费存储 |
| **Toast 通知** ⭐ | 替换 alert() 弹窗，操作反馈更优雅 |
| **增强健康检查** ⭐ | 后端 `/api/health` 端点同时验证 LLM 和 Embedding 连接状态 |
| **标签系统** ⭐ NEW | 为笔记本添加标签，按标签筛选，标签彩色徽章展示 |
| **全局搜索** ⭐ NEW | ⌘K 跨笔记本全文搜索，结果含原文片段和来源上下文 |
| **对话导出** ⭐ NEW | 一键导出对话为格式化的 Markdown 文件（含引用脚注） |
| **笔记本导出** ⭐ NEW | 一键导出整个笔记本为 ZIP 包（含文档、对话、元数据） |
| **AI 建议问题** ⭐ NEW | 基于上传文档自动生成 3-5 个相关问题（可配置开关） |
| **文档/笔记本摘要** ⭐ NEW | AI 生成文档摘要和笔记本概览，带缓存避免重复生成 |
| **对话历史面板** ⭐ NEW | 查看/切换/置顶/删除历史对话，自动生成对话标题 |
| **键盘快捷键** ⭐ NEW | ⌘K 搜索、⌘J 新对话、⌘E 导出、⌘N 新建笔记本、? 帮助面板 |
| **AI 功能开关** ⭐ NEW | Settings 面板中独立控制建议问题/自动摘要/智能标题，显示 token 成本 |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 14 (port 3000)                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────────┐  │
│  │ Sidebar  │  │ Source   │  │        Chat Panel              │  │
│  │ 笔记本   │  │ Panel    │  │  问答 + 引用 + 建议问题         │  │
│  │ 标签筛选 │  │ 文档上传 │  │  多轮对话 + 摘要卡片            │  │
│  │ 全局搜索 │  │ 文档摘要 │  │  SSE 流式 + 对话导出            │  │
│  │ 导出按钮 │  │          │  │  对话历史 + 标题                │  │
│  └──────────┘  └──────────┘  └───────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  SearchDialog  │  SettingsDialog  │  ShortcutsHelpDialog     ││
│  └──────────────────────────────────────────────────────────────┘│
│                       │                                          │
│              /api/* proxy (next.config.js)                        │
└───────────────────────┼──────────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────────┐
│          FastAPI (port 8000)                                     │
│  ┌──────────┐  ┌───────┐  ┌────────┐  ┌──────────────────────┐  │
│  │ Parser   │→│Chunker│→│Embedder│→│     ChromaDB          │  │
│  │ PDF/DOCX │  │ 智能   │  │ 向量化  │  │  per-notebook +       │  │
│  │ URL/PPTX │  │ 分块   │  │ 本地回退│  │  global_search        │  │
│  │ 图片检测 │  │ 代码感知│  │ 模型缓存│  │                      │  │
│  └──────────┘  └───────┘  └────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ RAG Pipeline: HyDE → embed → search → LLM                   │ │
│  │ 多轮对话上下文 + 流式引用标注                                │ │
│  │ Summaries Pipeline: chunk → generate → cache                 │ │
│  │ Suggested Questions: context → LLM → 3-5 questions           │ │
│  │ Export Pipeline: Markdown + ZIP (zipfile streaming)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Routers: notebooks │ documents │ chat │ search │ summaries      │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                  ┌─────┴─────┐
                  │   LLM API │
                  │ (OpenAI / │
                  │  Ollama / │
                  │  DeepSeek)│
                  └───────────┘
```

---

## 环境要求

| 组件 | 最低版本 | 说明 |
|------|----------|------|
| Python | 3.10+ | 后端运行环境 |
| Node.js | 18+ | 前端编译和运行 |
| pip | 最新 | Python 包管理器 |
| RAM | 8GB (API) / 16GB (Ollama) | 取决于模型方案 |

---

## 快速开始

### 1. 安装依赖

双击 `setup.bat`，或手动执行：

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 2. 配置模型

编辑 `backend\.env`，填入你的 API 信息（详见下方模型配置）。

也可以在浏览器中点击侧边栏底部的 **Settings** 按钮配置（存入 localStorage）。

### 3. 启动

双击 `start.bat`，或手动执行：

```bash
# 终端 1：启动后端
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 终端 2：启动前端
cd frontend
npx next dev -p 3000
```

浏览器访问 **[http://localhost:3000](http://localhost:3000)**

---

## 模型配置

### 方案 A：Ollama 本地模型（免费，数据完全本地）

```bash
# 1. 安装 Ollama
# 下载地址：https://ollama.com

# 2. 拉取模型
ollama pull qwen2.5:7b          # 对话模型
ollama pull nomic-embed-text     # 向量化模型

# backend\.env
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:7b
EMBED_MODEL=nomic-embed-text
```

> 推荐模型：`qwen2.5:7b`（中文优秀）、`llama3:8b`、`mistral:7b`

### 方案 B：OpenAI API

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o
EMBED_MODEL=text-embedding-3-small
```

### 方案 C：DeepSeek API

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=deepseek-chat
# DeepSeek 暂不提供 Embedding API，系统会自动回退到本地模型
```

### 方案 D：兼容接口（One-API / New-API 等中转）

```env
LLM_BASE_URL=https://your-proxy.com/v1
LLM_API_KEY=your-key
LLM_MODEL=claude-3.5-sonnet
```

### 高级配置

```env
# 禁用 HyDE 查询扩展（如果 LLM 较慢或想节省 token）
HYDE_ENABLED=false

# 调整检索参数
RETRIEVAL_TOP_K=8       # 检索返回的最大段落数
CHUNK_SIZE=1500         # 分块大小
CHUNK_OVERLAP=300       # 分块重叠
```

### 模型要求

- **对话模型**：只需文本模型，**不需要多模态** - 系统仅传入纯文本 Prompt
- **Embedding 模型**：必须是文本 Embedding 模型

---

## 支持的文档类型

| 格式 | 扩展名 | 解析方式 |
|------|--------|----------|
| PDF | `.pdf` | PyMuPDF，保留页码信息，自动检测扫描件（图片 PDF） |
| Word | `.docx` | python-docx，含表格提取 |
| PowerPoint | `.pptx` | python-pptx，按幻灯片拆分 |
| 纯文本 | `.txt` | 原生读取 |
| Markdown | `.md` `.mdx` | 按标题层级分块，嵌入结构化上下文 |
| 网页 | URL 输入 | BeautifulSoup 抓取正文 |
| HTML | `.html` | 去除脚本/样式后提取文本 |
| CSV | `.csv` | 渲染为 Markdown 表格（限 5000 行） |
| 代码 | `.py` `.js` `.ts` `.tsx` `.jsx` `.json` `.yaml` `.yml` `.css` | 按函数/类边界智能分块 |

---

## 使用指南

### 基本操作

1. **创建笔记本**：点击侧边栏 **新建笔记本** 按钮
2. **上传文档**：在源面板拖拽文件或点击浏览，或切换到 URL 模式粘贴链接
3. **开始提问**：在聊天输入框输入问题，按 Enter 发送（支持 Shift+Enter 换行暂未实现，但在输入框中可用）
4. **查看引用**：AI 回答中带有 `[1]` `[2]` 编号，鼠标 hover 可查看原文片段；回答底部显示全部信息来源
5. **保存笔记**：hover AI 回答右侧的 `+` 按钮，将回答保存为笔记
6. **继续追问**：AI 会记住对话历史，可以连续提问深入探讨
7. **测试连接**：点击 Settings 中的「测试连接」按钮，验证 LLM 和 Embedding 服务是否正常

### 文档管理

- **查看文档**：左侧源面板列出所有已上传的文档及分块数量
- **删除文档**：hover 文档卡片右侧出现 `×` 按钮，带文件名确认
- **重复检测**：上传已有文档或 URL 时会自动拦截并提示

### 标签系统

- 每个笔记本支持添加多个**标签**，标签显示为彩色徽章
- 在侧边栏笔记本名称下方点击 `+` 添加标签，自动补全已有标签
- 点击标签徽章**筛选**侧边栏，只显示带有该标签的笔记本
- 点击 `×` 清除筛选，恢复显示全部笔记本

### 全局搜索 (⌘K)

- 按 **⌘K**（Mac）或 **Ctrl+K**（Windows）打开全局搜索对话框
- 输入关键词实时搜索所有笔记本中的文档内容
- 结果包含原文片段、文档名称、所属笔记本
- 点击结果直接**跳转**到对应笔记本

### 导出

- **导出对话**：聊天面板顶部点击下载图标，保存为格式化的 Markdown 文件（含引用脚注）
- **导出笔记本**：右键笔记本或点击上下文菜单中的导出选项，下载包含文档、对话、元数据的 ZIP 包

### AI 增强功能 ⭐

- **建议问题**：打开笔记本时，AI 基于文档内容生成 3-5 个相关问题，点击即可发送
- **文档摘要**：源面板中文档可展开 AI 生成的摘要卡片，带缓存避免重复生成
- **笔记本摘要**：聊天区域顶部可查看整个笔记本的 AI 概览
- **对话标题**：首次发送消息后自动生成对话标题，支持手动编辑
- 所有 AI 功能均可在 Settings → **AI Features** 中独立开关

### 对话历史

- 点击对话历史面板查看所有历史对话
- 自动生成的标题和日期信息，点击切换对话
- 支持**置顶**和**删除**对话
- 点击「新建对话」开始全新会话

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘K` | 打开全局搜索 |
| `⌘J` | 新建对话 |
| `⌘E` | 导出当前对话 |
| `⌘N` | 新建笔记本 |
| `⌘,` | 打开设置 |
| `?` | 显示快捷键帮助面板 |

> macOS 使用 ⌘，Windows/Linux 使用 Ctrl

### 对话历史

- 每个笔记本的对话历史**自动保存**在浏览器 localStorage 中
- 关闭页面或刷新后重新打开同一笔记本，历史对话会自动恢复
- 点击「清空」按钮会弹出确认弹窗，防止误操作

### 设置

- 点击侧边栏底部 **Settings** 按钮
- 可分别配置 LLM（对话）和 Embedding（向量化）的 API 地址和密钥
- 点击「测试连接」验证配置是否正确
- 配置保存在浏览器 localStorage，不会上传到任何服务器

### 深色模式

- 点击侧边栏底部的浅色/深色模式按钮切换主题
- 首次访问会自动跟随系统偏好
- 设置保存在 localStorage

---

## 项目结构

```
notelm/
├── backend/                    # Python FastAPI (端口 8000)
│   ├── app/
│   │   ├── main.py             # 入口 + CORS + 健康检查 + 静态文件
│   │   ├── config.py           # 环境变量配置 (HyDE 开关等)
│   │   ├── database.py         # ChromaDB 初始化及 CRUD
│   │   ├── routers/
│   │   │   ├── notebooks.py    # 笔记本 CRUD API + 标签管理 + ZIP 导出
│   │   │   ├── documents.py    # 文档上传/URL抓取 + 重复检测 + 内容预览
│   │   │   ├── chat.py         # RAG 对话 + SSE 流式 + 多轮上下文 + 导出 + 建议问题 + 对话历史
│   │   │   ├── search.py       # 全局搜索 API（跨笔记本）NEW
│   │   │   └── summaries.py    # 文档/笔记本摘要生成 API NEW
│   │   ├── services/
│   │   │   ├── parser.py       # 多格式文档解析器（含图片PDF检测）
│   │   │   ├── chunker.py      # 智能文本分块（代码感知+结构上下文）
│   │   │   ├── embedder.py     # Embedding 生成 + 本地回退（模型缓存）
│   │   │   └── rag.py          # RAG 检索+生成管线 (HyDE+多轮对话)
│   │   └── models/
│   │       └── schemas.py      # Pydantic 数据模型
│   ├── requirements.txt        # Python 依赖
│   ├── .env.example            # 环境变量模板
│   └── .env                    # 实际环境变量（需自行创建）
│
├── frontend/                   # Next.js 14 App Router (端口 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # 根布局 (ThemeProvider + ToastProvider + 侧边栏)
│   │   │   ├── page.tsx        # 首页 / 欢迎页
│   │   │   ├── globals.css     # Tailwind + 深色模式 + 动画
│   │   │   └── notebook/
│   │   │       └── [id]/
│   │   │           └── page.tsx # 笔记本详情页
│   │   ├── components/
│   │   │   ├── Sidebar.tsx             # 笔记本列表 + 标签筛选 + 全局搜索
│   │   │   ├── SourcePanel.tsx         # 文档源面板 + 摘要卡片
│   │   │   ├── UploadZone.tsx          # 拖拽上传 + URL抓取
│   │   │   ├── ChatPanel.tsx           # 聊天面板 + 流式引用 + 多轮对话 + 导出 + 建议问题
│   │   │   ├── ConversationHistory.tsx # 对话历史面板 + 自动标题 NEW
│   │   │   ├── SearchDialog.tsx        # 全局搜索对话框 (⌘K) NEW
│   │   │   ├── SuggestedQuestions.tsx  # AI 建议问题面板 NEW
│   │   │   ├── DocumentSummary.tsx     # 文档摘要卡片 NEW
│   │   │   ├── NotebookSummary.tsx     # 笔记本概览摘要 NEW
│   │   │   ├── KeyboardShortcuts.tsx   # 键盘快捷键处理 NEW
│   │   │   ├── ShortcutsHelpDialog.tsx # 快捷键帮助面板 (?) NEW
│   │   │   ├── NoteEditor.tsx          # 笔记编辑器 (服务端持久化)
│   │   │   ├── SettingsDialog.tsx      # API 设置弹窗 + AI 功能开关
│   │   │   ├── Toast.tsx               # Toast 通知组件
│   │   │   └── ThemeProvider.tsx       # 深色模式 Provider
│   │   ├── lib/
│   │   │   ├── api.ts               # 前端 API 封装 (支持流式引用)
│   │   │   ├── ai-features.ts       # AI 功能开关配置 NEW
│   │   │   └── conversations.ts     # 对话历史管理 NEW
│   │   └── types/
│   │       └── index.ts        # TypeScript 类型定义
│   ├── package.json
│   ├── next.config.js          # API 代理到 8000
│   └── tailwind.config.ts
│
├── data/                       # 运行时数据 (gitignore)
│   ├── chroma/                 # ChromaDB 向量持久化
│   ├── uploads/                # 上传的原始文件
│   ├── notes/                  # 笔记存储
│   ├── notebooks_meta.json     # 笔记本元数据
│   └── documents_meta.json     # 文档元数据
│
├── build-dist.py               # 构建分发版本（无需 Node.js）
├── start.bat                   # 一键启动（后端 + 前端）
├── setup.bat                   # 首次安装依赖
├── .gitignore
└── README.md                   # 本文档
```

---

## 前置校验报告

| 类别 | 详情 |
|------|------|
| **隐性假设** | 假设用户已安装 Python 3.10+ 和 Node.js 18+；首次使用需运行 `setup.bat`；LLM API 或 Ollama 需另行配置 |
| **潜在风险** | ChromaDB 在 Windows 上使用 SQLite 后端，文档 chunks 超过 10000 条时检索延迟增加；首次启动本地 embedding 会自动下载 `all-MiniLM-L6-v2` 模型（约 80MB），之后缓存复用 |
| **HyDE 注意** | HyDE 查询扩展默认开启，每次检索会额外调用一次 LLM（轻量生成），可在 `.env` 中设置 `HYDE_ENABLED=false` 关闭 |
| **并发限制** | 当前为单线程同步处理，同时上传多个大文档会串行执行；聊天 SSE 为单连接流式 |
| **安全注意** | `.env` 文件包含 API Key，不要提交到 Git；API Key 在前端 Settings 中存储在 localStorage，仅发送到后端用于请求 API |
| **数据持久化** | ChromaDB 数据在 `data/chroma/`，笔记本元数据在 `data/notebooks_meta.json`，文档元数据在 `data/documents_meta.json`，笔记在 `data/notes/`，对话历史在 localStorage |
| **Embedding 维度** | 切换 Embedding 模型（如从 OpenAI 切换到本地）可能导致向量维度不匹配，建议一个笔记本使用同一个 Embedding 模型 |

---

## 常见问题

### Q: 上传 PDF 后提示 "No extractable text"？

如果 PDF 是扫描件/图片 PDF（无嵌入文本层），系统会给出明确提示。需要使用 OCR 工具（如 Adobe Acrobat、Tesseract）先将扫描件转为可搜索 PDF。

### Q: 如何获得更好的检索效果？

1. 确保 `HYDE_ENABLED=true`（默认开启）—— 这会通过假设文档生成来扩展查询
2. 使用更具体的问题描述，而非简短的查询词
3. 在 Markdown 文档中使用良好的标题层级（h1/h2/h3）

### Q: 如何更换 LLM 模型？

在 Settings 弹窗中修改 Model 名称后点击「测试连接」确认可用，或直接编辑 `backend\.env` 中的 `LLM_MODEL`。

### Q: 对话历史保存在哪？

每个笔记本的对话历史保存在浏览器的 localStorage 中，键名为 `chat_history_<notebook_id>`。清除浏览器数据会导致对话历史丢失。

### Q: 支持图片吗？

图片 PDF（扫描件）当前不支持，需要先用 OCR 工具转为可搜索 PDF。对话和检索管线也暂不支持图片输入。

### Q: ChromaDB 数据如何备份？

直接复制 `data/chroma/` 和 `data/*.json` 文件即可完整备份。笔记数据在 `data/notes/` 目录中。

### Q: 如何关闭 HyDE 以节省 token？

在 `backend\.env` 中设置 `HYDE_ENABLED=false`，重启后端即可。关闭后每次检索可节省约 200 token 的 LLM 调用。
