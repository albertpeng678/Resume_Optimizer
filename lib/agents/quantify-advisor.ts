export interface QuantifyResult {
  number: string
  metric: string
  background: string
}

export interface QuantifyEntry {
  id: string
  topic: string
  context: string
  result: QuantifyResult | null
  rounds: Array<{ role: 'user' | 'assistant'; content: string }>
  completedAt: string
}

export interface FormulaVariable {
  key: string        // e.g. "before", "after"
  label: string      // e.g. "優化前（秒）"
  placeholder: string
  estimated?: string // LLM pre-filled estimate
}

export interface FormulaTemplate {
  id: string              // e.g. "time_reduction"
  label: string           // e.g. "時間縮短"
  formula: string         // e.g. "((before - after) / before) * 100"
  resultTemplate: string  // e.g. "縮短 {result}%"
  variables: FormulaVariable[]
  traceFormula: string    // human-readable: e.g. "(before - after) / before × 100%"
}

export function buildFormulaSuggestionPrompt(
  topic: string,
  context: string,
  originalText: string,
  formulaHint: string
): string {
  return `你是一位履歷量化顧問，專門幫助求職者將工作成果轉換為具體數字。

## 任務
根據以下工作經歷，提議 1-2 個最適合的量化公式模板。

**主題**：${topic}
**背景**：${context}
**原文**：${originalText}
**公式提示**：${formulaHint}

## 可用的公式類型

1. **time_reduction**（時間縮短）
   - 公式：\`((before - after) / before) * 100\`
   - 結果範本：\`縮短 {result}%\`
   - 變數：before(優化前，含時間單位), after(優化後，含時間單位)
   - 用途：當工作涉及流程優化、自動化時

2. **scale_impact**（規模影響）
   - 公式：\`count\`
   - 結果範本：\`影響 {result} 人/件\`
   - 變數：count(人數或件數)
   - 用途：當工作涉及影響範圍、覆蓋面積時

3. **cost_savings**（成本節省）
   - 公式：\`((before - after) / before) * 100\`
   - 結果範本：\`節省 {result}%\`
   - 變數：before(原始成本), after(優化後成本)
   - 用途：當工作涉及成本削減、採購優化時

4. **percentage_improvement**（百分比提升）
   - 公式：\`improvement_percent\`
   - 結果範本：\`提升 {result}%\`
   - 變數：improvement_percent(提升百分比)
   - 用途：當工作涉及效率、品質、收入提升時

## 指示

1. 根據公式提示 ${formulaHint}，選擇 1-2 個最相關的公式類型
2. 為每個變數填入 \`estimated\` 字段，基於 \`context\` 和 \`originalText\` 中的線索進行教育化猜測
3. 返回**純 JSON 陣列**，不含 markdown 代碼塊、解釋文字或其他內容
4. 每個變數的 placeholder 應該清楚說明用戶應該輸入什麼

## 輸出格式

返回一個 JSON 陣列，包含 1-2 個 FormulaTemplate 物件：

\`\`\`json
[
  {
    "id": "formula_id",
    "label": "顯示名稱",
    "formula": "計算公式",
    "resultTemplate": "結果範本",
    "traceFormula": "人類可讀的公式說明",
    "variables": [
      {
        "key": "variable_key",
        "label": "變數標籤",
        "placeholder": "輸入提示",
        "estimated": "預估值（如果能從背景推測）"
      }
    ]
  }
]
\`\`\`

**重要**：只返回 JSON，不含任何其他文字或 markdown 標記。`
}
