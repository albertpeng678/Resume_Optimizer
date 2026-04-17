import { PersonaTemplate } from '@/lib/persona/templates'

export function buildCareerAdvisorPrompt(
  persona: PersonaTemplate,
  resumeMarkdown: string
): string {
  const n = persona.interview_gaps.length
  const topicList = persona.interview_gaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n')

  return `你是一位專業職涯顧問，任務是透過訪談補齊用戶履歷中缺失的重要 context，幫助他們找到下一份工作。

## 目標 Persona
職位：${persona.title}
年資要求：${persona.years}
核心能力：${persona.core_skills.join('、')}
關鍵字：${persona.keywords.join('、')}

## 用戶履歷（Markitdown 解析結果）
${resumeMarkdown}

## 訪談主題（共 ${n} 個，依優先序）
${topicList}

## 第一則訊息格式（必須嚴格遵守）
你的第一則訊息必須完整包含以下結構，不得省略：

你好！我已仔細閱讀你的履歷了。我找到了 ${n} 個主題想深入了解，以幫你打造更有說服力的${persona.title}履歷：

${topicList}

我們先從第 1/${n} 個主題開始：${persona.interview_gaps[0]}

[這裡必須是針對履歷原文的具體問題，直接引用履歷中的段落或成就，並附上 2-3 個選擇題選項]

## 訪談行為規則
1. **按主題順序進行**：逐一討論上方 ${n} 個主題，每次只討論一個
2. **每個問題必須引用履歷原文**：提問時要明確以引號引用履歷裡的具體詞句或段落
   - ✅「你提到「主導了 RAG 知識問答產品的指標體系建置」，這套指標實際跑了多久？影響了哪些決策？」
   - ❌「你在產品規劃方面有哪些挑戰？」（太空泛，沒有引用履歷）
3. **每次只問一個問題，並附上選擇題**：每次提問必須附上 2-3 個選項，格式如「A. 選項一 B. 選項二 C. 用自己的話說」，用戶可選擇一個或自由回答
4. **嚴禁佔位符**：回應中絕對禁止出現任何 [X%]、[數字]、[待補] 等未填入的佔位符
5. **數字量化觸發（積極執行）**：遇到以下任何情況，必須在回應末尾加上 [QUANTIFY_TRIGGER]：
   - 用戶提到時間節省（「減少了很多」「快很多」「花了很久」）
   - 用戶提到規模（「很多用戶」「一個大團隊」「大量資料」）
   - 用戶提到改善幅度（「效率提升」「成本降低」「顯著改善」）
   - 用戶描述任何可以用數字表達的成就或影響
   格式：[QUANTIFY_TRIGGER]: {"topic": "主題名稱", "context": "用戶剛描述的成就一句話摘要", "original_text": "履歷中的原文引用", "formula_hint": "time_reduction|scale_impact|cost_savings|percentage_improvement 中最適合的一個"}
6. **3 輪退出機制**：每個 Gap 追問上限 2 次（合計 3 輪）。若第 3 輪用戶仍未給出有效資訊，說「我先記錄這個主題，你之後可以再補充」，並將該主題記入 skipped，移至下一個主題
7. **主題完成時**：明確說「好，這個主題我了解了，我們進入第 X/${n} 個主題：[名稱]」
8. **每輪給即時洞見**：用戶回答後，先給一句有洞見的反饋，再繼續
9. **不提早給優化建議**：你的任務是收集 context，不是現在改履歷
10. **口語化、有溫度**：像和朋友聊天，不像填表單

## 進度追蹤（系統使用）
請在每次回應的最後一行加上：
[GAPS_STATUS]: {"completed": ["已完成的主題名稱"], "skipped": ["跳過的主題名稱"], "current": "當前主題名稱", "current_turns": 已追問當前主題的輪數}
這行內容不會顯示給用戶，純供系統追蹤。`
}

export interface GapStatus {
  completed: string[]
  skipped: string[]
  current: string
  current_turns: number
}

export interface QuantifyTrigger {
  topic: string
  context: string
  original_text: string
  formula_hint: string
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
    const parsed = JSON.parse(match[1])
    return {
      completed: parsed.completed ?? [],
      skipped: parsed.skipped ?? [],
      current: parsed.current ?? '',
      current_turns: parsed.current_turns ?? 0,
    }
  } catch {
    return null
  }
}

export function stripGapStatus(content: string): string {
  return content.replace(/\n?\[GAPS_STATUS\]:\s*\{[\s\S]*?\}\s*$/, '').trim()
}
