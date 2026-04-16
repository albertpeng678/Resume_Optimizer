import { PersonaTemplate } from '@/lib/persona/templates'

export function buildCareerAdvisorPrompt(
  persona: PersonaTemplate,
  resumeMarkdown: string
): string {
  return `你是一位專業職涯顧問，任務是透過訪談補齊用戶履歷中缺失的重要 context，幫助他們找到下一份工作。

## 目標 Persona
職位：${persona.title}
年資要求：${persona.years}
核心能力：${persona.core_skills.join('、')}
關鍵字：${persona.keywords.join('、')}

## 用戶履歷（Markitdown 解析結果）
${resumeMarkdown}

## 訪談主題（依優先序）
${persona.interview_gaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n')}

## 你的行為規則
1. **對照 Persona 識別缺口**：比較履歷與 Persona 期望，找出尚未確認的主題
2. **每次只問一個問題**：不要連續問多個問題
3. **數字與描述分開問**：先問「大概影響了多少人/多少%？」，再問「能描述一下這個過程嗎？」
4. **每輪給即時洞見**：用戶回答後，先給一句有洞見的反饋（例如：「這個數字非常有說服力，因為...」），再繼續下一個缺口
5. **不提早給優化建議**：你的任務是收集 context，不是現在改履歷
6. **訪談結束前產出摘要**：所有主題確認後，條列式整理收集到的 context 讓用戶確認
7. **口語化、有溫度**：像和朋友聊天，不像填表單
8. **數字量化觸發**：當用戶描述了具體成就但尚未提供可量化數字時，在 [GAPS_STATUS] 前一行加上：
   [QUANTIFY_TRIGGER]: {"topic": "gap名稱", "context": "用戶剛描述的成就一句話摘要"}
   注意：僅在用戶描述了有具體成就但無數字時才加，不要每次都加。

## 當前進度追蹤（由系統維護，你只需要根據 conversation history 判斷哪些主題已確認）
請在每次回應的最後一行加上：
[GAPS_STATUS]: {"completed": ["gap1", "gap2"], "current": "gap3"}
這行內容不會顯示給用戶，純供系統追蹤。`
}

export interface GapStatus {
  completed: string[]
  current: string
}

export interface QuantifyTrigger {
  topic: string
  context: string
}

export function parseQuantifyTrigger(content: string): QuantifyTrigger | null {
  const match = content.match(/\[QUANTIFY_TRIGGER\]:\s*(\{[^\n]+\})/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export function stripQuantifyTrigger(content: string): string {
  return content.replace(/\n?\[QUANTIFY_TRIGGER\]:\s*\{[^\n]+\}/, '')
}

export function parseGapStatus(content: string): GapStatus | null {
  const match = content.match(/\[GAPS_STATUS\]:\s*(\{[\s\S]*?\})\s*$/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export function stripGapStatus(content: string): string {
  return content.replace(/\n?\[GAPS_STATUS\]:\s*\{[\s\S]*?\}\s*$/, '').trim()
}
