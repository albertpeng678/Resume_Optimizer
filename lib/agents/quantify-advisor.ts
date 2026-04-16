export interface QuantifyResult {
  number: string      // e.g. "30"
  metric: string      // e.g. "% 縮短客戶導入時間"
  background: string  // e.g. "用戶估計從 7 天縮至 5 天，約 30% 改善"
}

export interface QuantifyEntry {
  id: string          // crypto.randomUUID() - 對應 [Q:id] 標籤
  topic: string       // 對應的 gap 主題
  context: string     // 觸發量化的問題摘要
  result: QuantifyResult | null   // null = 無法量化
  rounds: Array<{ role: 'user' | 'assistant'; content: string }>
  completedAt: string
}

export type QuantifyOutcome =
  | { type: 'continue' }
  | { type: 'result'; data: QuantifyResult }
  | { type: 'failed' }

export function buildQuantifyAdvisorPrompt(
  topic: string,
  context: string,
  currentRound: number
): string {
  return `你是一位數據萃取專家，專門透過技巧性問答幫助求職者找出可以放在履歷上的量化數字。

## 任務
針對用戶分享的工作經歷「${topic}」，挖掘出一個具體可量化的數字。
觸發情境：${context}

## 訪談策略（共 5 輪，目前第 ${currentRound} 輪）
- 輪次 1-2：建立錨點，用比較性問題（「相比之前，大概快了多少？是 10% 還是更多？」）
- 輪次 3-4：縮小範圍，提供估算框架（「如果一年處理 X 件，那影響了多少件？」）
- 輪次 5：整合所有線索，給出最終判斷或宣告無法量化

## 問答技巧
1. 每次只問一個問題
2. 優先用選擇題讓用戶好回答（「是接近 20% 還是 50%？」）
3. 若用戶說「很多」、「顯著」，必須追問具體範圍
4. 用時間換算法（「一天省了多少分鐘？乘以一年 250 天？」）
5. 允許用「大約」或「估算」，不需要精確數字

## 絕對禁止
- 禁止捏造或暗示用戶接受你猜的數字
- 若用戶 5 輪後仍無法提供任何具體線索，誠實告知無法量化

## 輸出格式（僅第 5 輪）
第 5 輪時，**必須先輸出一段完整的中文總結**（至少 2 句話），再在最後一行加上標籤：

成功時（先總結，最後一行加標籤）：
好的，根據您的描述，[您的具體說明]。這個數字可以有效展示您的工作成果。
[QUANTIFY_RESULT]: {"number":"30","metric":"% 縮短客戶導入時間","background":"根據您的描述，導入流程從原本 7 天縮短至約 5 天，約 30% 的改善"}

無法量化時（先說明，最後一行加標籤）：
感謝您的分享。您的情況難以轉換為具體數字，但您的描述本身已經很有說服力。
[QUANTIFY_FAILED]

（第 1-4 輪不需要輸出上述標籤，繼續追問即可）`
}

const RESULT_REGEX = /\[QUANTIFY_RESULT\]:\s*(\{[\s\S]*?\})\s*$/m
const FAILED_REGEX = /\[QUANTIFY_FAILED\]\s*$/m

export function parseQuantifyResponse(
  content: string,
  round: number
): { cleanContent: string; outcome: QuantifyOutcome } {
  if (round < 5) {
    return { cleanContent: content.trim(), outcome: { type: 'continue' } }
  }

  // Round 5: check for terminal tokens
  const resultMatch = content.match(RESULT_REGEX)
  if (resultMatch) {
    try {
      const data: QuantifyResult = JSON.parse(resultMatch[1])
      const cleanContent = content.replace(RESULT_REGEX, '').trim()
      return { cleanContent, outcome: { type: 'result', data } }
    } catch {
      // Malformed JSON - treat as failed
    }
  }

  if (FAILED_REGEX.test(content)) {
    const cleanContent = content.replace(FAILED_REGEX, '').trim()
    return { cleanContent, outcome: { type: 'failed' } }
  }

  // Round 5 but no terminal token yet - treat as continue (LLM might have not followed format)
  return { cleanContent: content.trim(), outcome: { type: 'continue' } }
}
