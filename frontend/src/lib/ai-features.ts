/**
 * AI feature toggle keys and helpers.
 *
 * Each toggle is stored in localStorage as a boolean string ("true" / "false").
 * All features default to enabled to preserve existing behaviour.
 */

export const AI_FEATURE_KEYS = {
  suggestedQuestions: "ai_suggested_questions_enabled",
  autoSummaries: "ai_auto_summaries_enabled",
  smartTitles: "ai_smart_titles_enabled",
} as const

export type AIFeatureKey = (typeof AI_FEATURE_KEYS)[keyof typeof AI_FEATURE_KEYS]

/** Estimated token costs shown in the settings UI. */
export const AI_FEATURE_TOKEN_COST: Record<AIFeatureKey, string> = {
  [AI_FEATURE_KEYS.suggestedQuestions]: "约 100–300 tokens/次",
  [AI_FEATURE_KEYS.autoSummaries]: "约 200–800 tokens/次",
  [AI_FEATURE_KEYS.smartTitles]: "约 30–80 tokens/次",
}

/** Human-readable labels for the settings UI. */
export const AI_FEATURE_LABELS: Record<AIFeatureKey, string> = {
  [AI_FEATURE_KEYS.suggestedQuestions]: "建议问题",
  [AI_FEATURE_KEYS.autoSummaries]: "自动摘要",
  [AI_FEATURE_KEYS.smartTitles]: "智能标题",
}

/** Descriptions for the settings UI tooltips / help text. */
export const AI_FEATURE_DESCRIPTIONS: Record<AIFeatureKey, string> = {
  [AI_FEATURE_KEYS.suggestedQuestions]:
    "打开笔记本时自动生成与文档内容相关的提问建议，帮助你快速开始对话。",
  [AI_FEATURE_KEYS.autoSummaries]:
    "为每个文档和笔记本生成 AI 摘要，快速了解内容要点。",
  [AI_FEATURE_KEYS.smartTitles]:
    "根据对话第一条消息自动生成简洁的对话标题，方便查找和管理。",
}

/**
 * Read a feature toggle from localStorage.  Defaults to `true` (enabled)
 * when no value has been saved yet.
 */
export function isFeatureEnabled(key: AIFeatureKey): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return true // default on
    return raw === "true"
  } catch {
    return true
  }
}

/**
 * Persist a feature toggle to localStorage.
 */
export function setFeatureEnabled(key: AIFeatureKey, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "true" : "false")
  } catch { /* quota exceeded or unavailable — silently ignore */ }
}

/**
 * Get all feature toggle states at once.
 */
export function getAllFeatureSettings(): Record<AIFeatureKey, boolean> {
  return {
    [AI_FEATURE_KEYS.suggestedQuestions]: isFeatureEnabled(AI_FEATURE_KEYS.suggestedQuestions),
    [AI_FEATURE_KEYS.autoSummaries]: isFeatureEnabled(AI_FEATURE_KEYS.autoSummaries),
    [AI_FEATURE_KEYS.smartTitles]: isFeatureEnabled(AI_FEATURE_KEYS.smartTitles),
  }
}
