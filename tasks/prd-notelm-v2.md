# PRD: Notelm v2.0 — NotebookLM 80% UX Parity

## Introduction

Notelm v1.0.0 provides core RAG functionality (document upload, AI Q&A with citations, notebooks). v2.0 aims to reach 80%+ parity with Google NotebookLM by adding 8 high-impact features: export, tags, global search, suggested questions, summaries, conversation titles, keyboard shortcuts, and notebook sharing. All LLM-consuming features are configurable toggles.

## Goals

- Add tag-based notebook organization with filtering
- Enable full-text cross-notebook search via global ChromaDB index
- Export conversations as Markdown and entire notebooks as ZIP + Markdown
- AI-powered suggested questions based on uploaded documents (configurable toggle)
- AI-powered document and notebook summaries (configurable toggle)
- Auto-generated conversation titles from first user message
- Keyboard shortcuts for all common actions
- All new LLM features controllable via Settings panel toggles

## User Stories

### US-001: Add tags field and conversation title to notebook metadata
**Description:** As a developer, I need to store tags, conversation titles, and pinned status in notebook metadata so the frontend can persist these values.

**Acceptance Criteria:**
- [ ] Add `tags: List[str]` field to notebook metadata JSON (default empty array)
- [ ] Add `title: Optional[str]` and `pinned: bool` fields to chat message/conversation metadata
- [ ] Update backend notebook create/update schemas to accept tags
- [ ] Update chat message schema to include title and pinned fields
- [ ] Backend tests pass
- [ ] Frontend type definitions updated (types/index.ts)

### US-002: Create global search index in ChromaDB
**Description:** As a developer, I need a global ChromaDB collection that indexes documents across all notebooks for cross-notebook search.

**Acceptance Criteria:**
- [ ] Create `global_search` ChromaDB collection on app startup
- [ ] Index document chunks with notebook_id metadata on document upload
- [ ] Remove chunks from global index when document is deleted
- [ ] Re-index all existing documents on first startup (migration)
- [ ] Backend tests pass

### US-003: Tag management API endpoints
**Description:** As a developer, I need CRUD API endpoints for notebook tags.

**Acceptance Criteria:**
- [ ] `PATCH /api/notebooks/{id}` accepts tags update
- [ ] `GET /api/notebooks?tag=xxx` filters notebooks by tag
- [ ] `GET /api/tags` returns all unique tags across notebooks
- [ ] `DELETE /api/tags/{name}` removes a tag from all notebooks
- [ ] Backend tests pass

### US-004: Global search API endpoint
**Description:** As a developer, I need an API that searches across all notebooks and returns results with notebook context.

**Acceptance Criteria:**
- [ ] `GET /api/search?q=xxx` returns ranked results from global index
- [ ] Each result includes: snippet, source document name, notebook_id, notebook name
- [ ] Empty query returns empty array (not error)
- [ ] Results deduplicated by chunk content
- [ ] Backend tests pass

### US-005: Export conversation API (Markdown)
**Description:** As a developer, I need an API that exports a conversation as formatted Markdown.

**Acceptance Criteria:**
- [ ] `GET /api/chat/export/{notebook_id}` returns Markdown string with all messages
- [ ] Markdown includes: conversation title, date, user/assistant roles, citations as footnotes
- [ ] `GET /api/chat/export/{notebook_id}?format=json` returns raw JSON alternative
- [ ] Response header `Content-Disposition: attachment; filename="conversation-{title}.md"`
- [ ] Backend tests pass

### US-006: Export notebook API (ZIP + Markdown bundle)
**Description:** As a developer, I need an API that exports an entire notebook as a downloadable package.

**Acceptance Criteria:**
- [ ] `GET /api/notebooks/{id}/export` generates ZIP containing:
  - `README.md` — notebook overview (name, date, document list, tags)
  - `conversation.md` — full conversation history
  - `documents/` — original uploaded files
  - `metadata.json` — notebook metadata (tags, dates, document info)
- [ ] ZIP file served with proper Content-Disposition header
- [ ] Backend tests pass

### US-007: Suggested questions generation API
**Description:** As a developer, I need an API that uses LLM to generate relevant suggested questions based on uploaded documents. Must be configurable via settings toggle.

**Acceptance Criteria:**
- [ ] `POST /api/chat/suggested-questions` returns 3-5 questions based on document context
- [ ] Questions are contextually relevant to uploaded documents (not generic)
- [ ] Respects `suggested_questions_enabled` boolean in notebook settings
- [ ] Returns empty array when toggle is off
- [ ] Handles case where no documents uploaded (returns generic starter questions)
- [ ] Backend tests pass

### US-008: Summary generation API (document + notebook level)
**Description:** As a developer, I need APIs to generate document-level and notebook-level summaries using LLM. Must be configurable.

**Acceptance Criteria:**
- [ ] `POST /api/documents/{id}/summarize` generates 2-3 paragraph summary of a single document
- [ ] `POST /api/notebooks/{id}/summarize` generates overview summary of all documents in notebook
- [ ] Respects `summarization_enabled` boolean in notebook settings
- [ ] Summary cached in document/notebook metadata (avoids re-generation)
- [ ] Cache invalidated when new documents added
- [ ] Backend tests pass

### US-009: Auto-generate conversation titles
**Description:** As a developer, I need the system to auto-generate a title for each conversation based on the first user message. Uses simple heuristics + optional LLM.

**Acceptance Criteria:**
- [ ] On first user message in a conversation, auto-generate title
- [ ] Default heuristic: truncate first message to 50 chars (smart truncation at word boundary)
- [ ] Optional LLM-based title generation (configurable toggle in settings)
- [ ] Title saved to conversation metadata
- [ ] Title displayed in conversation history sidebar
- [ ] User can manually edit title
- [ ] Backend tests pass

### US-010: Tag management UI in sidebar
**Description:** As a user, I want to see, add, edit, and filter tags in the sidebar so I can organize my notebooks.

**Acceptance Criteria:**
- [ ] Tags displayed as colored chips below each notebook name in sidebar
- [ ] "+" button on notebook to add tag (inline input with autocomplete from existing tags)
- [ ] Click tag chip to filter sidebar to show only notebooks with that tag
- [ ] Active tag filter shown as highlighted chip with "x" to clear
- [ ] "All Notebooks" option to clear tag filter
- [ ] Empty state when no notebooks match tag filter
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-011: Global search UI
**Description:** As a user, I want a search bar that searches across all my notebooks and shows results with context.

**Acceptance Criteria:**
- [ ] Search bar at top of sidebar (or in header) with ⌘K keyboard shortcut
- [ ] Search results dropdown shows: snippet, document name, notebook name, relevance score
- [ ] Clicking a result navigates to that notebook
- [ ] Debounced search (300ms) while typing
- [ ] Empty state: "Search all notebooks..." placeholder
- [ ] Loading spinner during search
- [ ] "No results found" for empty results
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-012: Export conversation button in ChatPanel
**Description:** As a user, I want to export the current conversation as Markdown with one click.

**Acceptance Criteria:**
- [ ] Export button (↓ icon) in ChatPanel header area
- [ ] Click triggers download of Markdown file
- [ ] Filename: `{notebook-name}-conversation-{date}.md`
- [ ] Toast notification on success: "Conversation exported"
- [ ] Button has tooltip: "Export conversation as Markdown"
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-013: Export notebook button in Sidebar
**Description:** As a user, I want to export an entire notebook as a ZIP package with one click.

**Acceptance Criteria:**
- [ ] Export button (📦 icon or "Export" menu item) in notebook context menu or header
- [ ] Click triggers download of ZIP file
- [ ] Filename: `{notebook-name}-{date}.zip`
- [ ] Toast notification with progress: "Preparing export..." → "Export ready"
- [ ] Loading state on button during ZIP generation
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-014: Suggested questions panel in chat area
**Description:** As a user, I want to see AI-generated suggested questions when I open a notebook, so I know what to ask.

**Acceptance Criteria:**
- [ ] Suggested questions displayed as clickable chips/cards in chat area when no conversation active
- [ ] Each question is a button — clicking it sends that message
- [ ] Questions disappear after first user message sent (or user can dismiss)
- [ ] Refresh button to generate new suggested questions
- [ ] Uses existing `suggested-questions` API (US-007)
- [ ] Respects settings toggle (hidden when disabled)
- [ ] Loading skeleton while questions being generated
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-015: Summary display cards
**Description:** As a user, I want to see AI-generated summaries for documents and notebooks so I can quickly understand content.

**Acceptance Criteria:**
- [ ] Document summary card: expandable section in SourcePanel showing 2-3 paragraph summary
- [ ] Notebook summary card: summary banner at top of chat area showing notebook overview
- [ ] "Generate Summary" button triggers generation (with loading state)
- [ ] Summary persists in metadata (cached — shows immediately on revisit)
- [ ] Regenerate button to refresh summary
- [ ] Respects settings toggle (feature hidden when disabled)
- [ ] Collapsed by default for documents, visible for notebook overview
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-016: Conversation history panel with auto-titles
**Description:** As a user, I want to see my conversation history with auto-generated titles and easily switch between conversations.

**Acceptance Criteria:**
- [ ] Conversation history panel accessible from chat area (sidebar or dropdown)
- [ ] Each conversation shows: auto-generated title, date, message count
- [ ] Current conversation highlighted
- [ ] Click to switch to a different conversation
- [ ] Pinned conversations appear at top with pin icon
- [ ] Pin/unpin button on each conversation
- [ ] "New Conversation" button to start fresh
- [ ] Delete conversation button with confirmation dialog
- [ ] Empty state: "No conversations yet. Start asking questions!"
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-017: Keyboard shortcuts system
**Description:** As a user, I want keyboard shortcuts for common actions so I can work faster.

**Acceptance Criteria:**
- [ ] `⌘K` / `Ctrl+K` — Open global search
- [ ] `⌘J` / `Ctrl+J` — New conversation
- [ ] `⌘E` / `Ctrl+E` — Export current conversation
- [ ] `⌘N` / `Ctrl+N` — New notebook
- [ ] `⌘,` / `Ctrl+,` — Open settings
- [ ] `?` — Show keyboard shortcuts help dialog
- [ ] Help dialog lists all shortcuts in a table format
- [ ] Shortcuts respect OS (⌘ on Mac, Ctrl on Windows/Linux)
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

### US-018: Settings panel — LLM feature toggles
**Description:** As a user, I want to enable/disable LLM-powered features from the Settings dialog to control API costs.

**Acceptance Criteria:**
- [ ] Settings dialog has new section: "AI Features"
- [ ] Toggle: "Suggested Questions" (default: off)
- [ ] Toggle: "Auto Summaries" (default: off)
- [ ] Toggle: "Smart Titles (LLM)" (default: off — basic truncation still works)
- [ ] Toggles saved to localStorage
- [ ] UI features show/hide based on toggle state without page refresh
- [ ] Tooltip on each toggle explaining token cost
- [ ] TypeScript compilation passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Notebook metadata schema extended with `tags: string[]`, `summary: string | null`
- FR-2: Chat message schema extended with `title: string | null`, `pinned: boolean`
- FR-3: Global ChromaDB collection `global_search` with notebook_id metadata on all chunks
- FR-4: Tag CRUD: create, list all tags, filter notebooks by tag, delete tag
- FR-5: Global search: query across all notebooks, return ranked results with context
- FR-6: Conversation export: Markdown format with citations as footnotes
- FR-7: Notebook export: ZIP containing README.md, conversation.md, documents/, metadata.json
- FR-8: Suggested questions: LLM generates 3-5 context-aware questions, toggleable
- FR-9: Document summary: LLM generates 2-3 paragraph summary, cached in metadata
- FR-10: Notebook summary: LLM generates overview of all documents, cached
- FR-11: Conversation titles: auto-generated from first message (heuristic + optional LLM)
- FR-12: Frontend tag UI: chips, filter, add/remove on notebooks
- FR-13: Frontend search: ⌘K global search bar with result dropdown
- FR-14: Frontend export: buttons in ChatPanel and Sidebar with toast feedback
- FR-15: Frontend suggested questions: clickable chips in empty chat state
- FR-16: Frontend summaries: expandable cards in SourcePanel and chat header
- FR-17: Frontend conversation history: panel with titles, pin, switch, delete
- FR-18: Frontend keyboard shortcuts: 6 shortcuts + help dialog
- FR-19: Settings panel: AI feature toggles persisted in localStorage
- FR-20: All existing features continue to work without regression

## Non-Goals

- No multi-modal/image support in LLM answers
- No real-time collaboration or multi-user support
- No audio overview / podcast generation (too complex for v2)
- No mobile app — desktop web only
- No cloud sync or backup
- No OAuth or user authentication system
- No batch document operations (deferred to v3)
- No FAQ/briefing/timeline generation (deferred to v3)
- No suggested follow-up questions (deferred to v3, merged into suggested questions for now)

## Technical Considerations

- **ChromaDB**: Global search uses new `global_search` collection. Existing per-notebook collections unchanged. Backfill migration on startup.
- **LLM costs**: All LLM features are off by default. Each toggle shows estimated token cost in tooltip. Summary caching prevents re-generation.
- **ZIP generation**: Use Python `zipfile` stdlib. Stream to client — don't write temp files.
- **Keyboard shortcuts**: Use `useEffect` + `keydown` listener. Detect OS for key display (⌘ vs Ctrl).
- **Reuse existing**: Toast component for export notifications, Sidebar for tag filter/search, ChatPanel for suggested questions, SourcePanel for document summaries.
- **Settings persistence**: Existing SettingsDialog already uses localStorage. Add new toggle fields to the same store.
- **SSE streaming**: Existing infrastructure for streaming chat — summaries could reuse the same pattern.

## Success Metrics

- Users can organize notebooks with tags and filter in < 2 clicks
- Global search returns results in < 1 second for up to 10K documents
- Conversation export produces a readable Markdown file
- Notebook export ZIP contains all expected files
- Suggested questions appear within 3 seconds of notebook open
- Document summary generation completes within 5 seconds
- Keyboard shortcuts reduce time for common actions by 50%+
- All existing v1.0.0 features continue to work

## Open Questions

- Should we add a "usage dashboard" showing token consumption per feature?
- Should conversation history support infinite scroll or pagination?
- Should the global search also search conversation messages (not just documents)?
