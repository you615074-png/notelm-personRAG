# Notelm — 本地个人 RAG 研究笔记

一个运行在本地的个人 RAG（检索增强生成）应用，界面和工作模式参考 Google NotebookLM。上传文档 → 自动解析 → 智能检索 → AI 基于你的资料回答问题并标注引用来源。

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

---

## 核心功能

| 功能 | 说明 |
|------|------|
| **多格式文档上传** | 支持 PDF、DOCX、PPTX、TXT、Markdown、代码文件、CSV、网页抓取 |
| **自动文件类型识别** | 根据扩展名自动选择解析器，无需手动选择 |
| **智能分块** | Markdown 按标题层级分块、代码按函数边界分块、通用文本滑动窗口分块 |
| **向量检索 (RAG)** | ChromaDB 存储向量，语义相似度检索 top-K 相关段落 |
| **AI 对话** | 基于检索结果构建上下文，LLM 生成带引用的回答 |
| **流式输出 (SSE)** | 回答逐字返回，体验流畅 |
| **引用标注** | AI 回答中自动标注 `[1]` `[2]`，hover 可查看来源原文片段 |
| **对话持久化** | 刷新/关闭页面后对话历史保留在本地 (localStorage) |
| **笔记本管理** | 创建/重命名/删除笔记本，每个笔记本独立隔离文档和对话 |
| **笔记编辑器** | 聊天对话一键保存为笔记，关联到当前笔记本 |
| **本地 Embedding 回退** | 若 Embedding API 不可用，自动使用 `all-MiniLM-L6-v2` 本地模型 |
| **API 设置面板** | 前端 Settings 弹窗修改 API 地址/密钥/模型，存入浏览器 localStorage |

---

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│               Next.js 14 (port 3000)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Sidebar  │  │ Source   │  │   Chat Panel     │  │
│  │ 笔记本   │  │ Panel    │  │   问答 + 引用     │  │
│  │ 列表     │  │ 文档上传 │  │   SSE 流式       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                       │                             │
│              /api/* proxy (next.config.js)           │
└───────────────────────┼─────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────┐
│          FastAPI (port 8000)                         │
│  ┌──────────┐  ┌───────┐  ┌────────┐  ┌─────────┐  │
│  │ Parser   │→│Chunker│→│Embedder│→│ChromaDB │  │
│  │ PDF/DOCX │  │ 分块   │  │ 向量化  │  │ 向量库  │  │
│  │ URL/PPTX │  │       │  │        │  │        │  │
│  └──────────┘  └───────┘  └────────┘  └────┬────┘  │
│                                             │        │
│  ┌──────────────────────────────────────────┘        │
│  │  RAG Pipeline: query → embed → search → LLM       │
│  └──────────────────────────────────────────────┘    │
│                       │                              │
└───────────────────────┼──────────────────────────────┘
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
|------|---------|------|
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

浏览器访问 **http://localhost:3000**

---

## 模型配置

### 方案 A：Ollama 本地模型（免费，数据完全本地）

```bash
# 1. 安装 Ollama
# 下载地址：https://ollama.com

# 2. 拉取模型
ollama pull qwen2.5:7b          # 对话模型
ollama pull nomic-embed-text     # 向量化模型
```

```env
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

### 模型要求

- **对话模型**：只需文本模型，**不需要多模态** - 系统仅传入纯文本 Prompt
- **Embedding 模型**：必须是文本 Embedding 模型

---

## 支持的文档类型

| 格式 | 扩展名 | 解析方式 |
|------|--------|---------|
| PDF | `.pdf` | PyMuPDF，保留页码信息 |
| Word | `.docx` | python-docx，含表格提取 |
| PowerPoint | `.pptx` | python-pptx，按幻灯片拆分 |
| 纯文本 | `.txt` | 原生读取 |
| Markdown | `.md` `.mdx` | 按标题层级分块 |
| 网页 | URL 输入 | BeautifulSoup 抓取正文 |
| HTML | `.html` | 去除脚本/样式后提取文本 |
| CSV | `.csv` | 渲染为 Markdown 表格 |
| 代码 | `.py` `.js` `.ts` `.tsx` `.jsx` `.json` `.yaml` `.yml` `.css` | 按函数/类边界分块 |

---

## 使用指南

### 基本操作

1. **创建笔记本**：点击侧边栏 **New Notebook** 按钮
2. **上传文档**：在源面板拖拽文件或点击浏览，或切换到 URL 模式粘贴链接
3. **开始提问**：在聊天输入框输入问题，按 Enter 发送
4. **查看引用**：AI 回答中带有 `[1]` `[2]` 编号，鼠标 hover 可查看原文片段
5. **保存笔记**：hover AI 回答右侧的 `+` 按钮，将回答保存为笔记

### 文档管理

- **查看文档**：左侧源面板列出所有已上传的文档及分块数量
- **删除文档**：hover 文档卡片右侧出现 `×` 按钮

### 对话历史

- 每个笔记本的对话历史**自动保存**在浏览器 localStorage 中
- 关闭页面或刷新后重新打开同一笔记本，历史对话会自动恢复
- 点击「Clear」按钮可清空当前笔记本的对话历史

### 设置

- 点击侧边栏底部 **Settings** 按钮
- 可分别配置 LLM（对话）和 Embedding（向量化）的 API 地址和密钥
- 配置保存在浏览器 localStorage，不会上传到任何服务器

---

## 项目结构

```
notelm/
├── backend/                    # Python FastAPI (端口 8000)
│   ├── app/
│   │   ├── main.py             # 入口 + CORS 中间件
│   │   ├── config.py           # 环境变量配置
│   │   ├── database.py         # ChromaDB 初始化及 CRUD
│   │   ├── routers/
│   │   │   ├── notebooks.py    # 笔记本 CRUD API
│   │   │   ├── documents.py    # 文档上传/URL抓取 API
│   │   │   └── chat.py         # RAG 对话 + SSE 流式 API
│   │   ├── services/
│   │   │   ├── parser.py       # 多格式文档解析器
│   │   │   ├── chunker.py      # 智能文本分块
│   │   │   ├── embedder.py     # Embedding 生成 + 本地回退
│   │   │   └── rag.py          # RAG 检索+生成管线
│   │   └── models/
│   │       └── schemas.py      # Pydantic 数据模型
│   ├── requirements.txt        # Python 依赖
│   ├── .env.example            # 环境变量模板
│   └── .env                    # 实际环境变量（需自行创建）
│
├── frontend/                   # Next.js 14 App Router (端口 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # 根布局 (侧边栏框架)
│   │   │   ├── page.tsx        # 首页 / 欢迎页
│   │   │   ├── globals.css     # Tailwind + 全局样式
│   │   │   └── notebook/
│   │   │       └── [id]/
│   │   │           └── page.tsx # 笔记本详情页
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # 左侧笔记本列表
│   │   │   ├── SourcePanel.tsx    # 文档源面板
│   │   │   ├── UploadZone.tsx     # 拖拽上传 + URL抓取
│   │   │   ├── ChatPanel.tsx      # 聊天面板 + 引用
│   │   │   ├── NoteEditor.tsx     # 笔记编辑器
│   │   │   └── SettingsDialog.tsx # API 设置弹窗
│   │   ├── lib/
│   │   │   └── api.ts          # 前端 API 封装
│   │   └── types/
│   │       └── index.ts        # TypeScript 类型定义
│   ├── package.json
│   ├── next.config.js          # API 代理到 8000
│   └── tailwind.config.ts
│
├── data/                       # 运行时数据 (gitignore)
│   ├── chroma/                 # ChromaDB 向量持久化
│   ├── uploads/                # 上传的原始文件
│   └── notebooks_meta.json     # 笔记本元数据
│
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
| **潜在风险** | ChromaDB 在 Windows 上使用 SQLite 后端，文档 chunks 超过 10000 条时检索延迟增加；首次启动 `sentence-transformers` 会自动下载 `all-MiniLM-L6-v2` 模型（约 80MB） |
| **并发限制** | 当前为单线程同步处理，同时上传多个大文档会串行执行；聊天 SSE 为单连接流式 |
| **安全注意** | `.env` 文件包含 API Key，不要提交到 Git；API Key 在前端 Settings 中存储在 localStorage，仅发送到后端用于请求 API |
| **数据持久化** | ChromaDB 数据在 `data/chroma/`，笔记本元数据在 `data/notebooks_meta.json`，文档元数据在 `data/documents_meta.json`，对话历史在 localStorage |

---

## 常见问题

### Q: 上传 PDF 后提问时提示 "No relevant sources"？

可能原因：
1. PDF 是扫描件/图片 PDF（无嵌入文本层），当前版本不支持 OCR
2. Embedding 服务未正常启动（检查后端日志）
3. 问题与文档内容不相关

### Q: 如何更换 LLM 模型？

在 Settings 弹窗中修改 Model 名称，或直接编辑 `backend\.env` 中的 `LLM_MODEL`。

### Q: 对话历史保存在哪？

每个笔记本的对话历史保存在浏览器的 localStorage 中，键名为 `chat_history_<notebook_id>`。清除浏览器数据会导致对话历史丢失。

### Q: 支持图片吗？

图片 PDF（扫描件）当前不支持，需要先用 OCR 工具转为可搜索 PDF。对话和检索管线也暂不支持图片输入。

### Q: ChromaDB 数据如何备份？

直接复制 `data/chroma/` 和 `data/*.json` 文件即可完整备份。
