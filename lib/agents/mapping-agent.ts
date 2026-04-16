import OpenAI from 'openai'
import { PersonaTemplate } from '@/lib/persona/templates'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface MappingInput {
  resumeMarkdown: string
  persona: PersonaTemplate
  collectedContext: Record<string, string>
  conversationHistory: Array<{ role: string; content: string }>
  quantifyData: QuantifyEntry[]
}

function buildQuantifySection(quantifyData: QuantifyEntry[]): string {
  const successful = quantifyData.filter((e) => e.result !== null)
  if (successful.length === 0) return ''

  const entries = successful
    .map((e) => `- ID: ${e.id} | ${e.result!.number}${e.result!.metric}（${e.result!.background}）`)
    .join('\n')

  return `
## 量化數字資料庫（訪談萃取）
以下是透過訪談精確量化的數字，若在履歷中使用，必須用 [Q:id]數字[/Q] 標籤標記：
${entries}

### 量化標籤使用範例
「將客戶導入時間縮短 [Q:${successful[0].id}]${successful[0].result!.number}${successful[0].result!.metric}[/Q]」`
}

export async function runMappingAgent(input: MappingInput): Promise<string> {
  const { resumeMarkdown, persona, collectedContext, conversationHistory, quantifyData } = input

  const contextSummary = Object.entries(collectedContext)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  const conversationSummary = conversationHistory
    .filter((m) => m.role === 'user')
    .slice(-20)
    .map((m) => m.content)
    .join('\n---\n')

  const quantifySection = buildQuantifySection(quantifyData)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是一位資深履歷撰寫專家，專門針對目標職位優化履歷內容。

## 目標 Persona
職位：${persona.title}（${persona.years}）
核心能力：${persona.core_skills.join('、')}
關鍵字（必須自然融入）：${persona.keywords.join('、')}
職責期望：${persona.responsibilities.join('；')}

## 你的任務
1. 以 STAR 框架（Situation-Task-Action-Result）重寫每條工作經歷
2. 數字化成果（優先使用量化數字資料庫中的數字）
3. 對齊 Persona 關鍵字（自然融入，不硬塞）
4. 用「解決問題」視角，而非「我做了什麼」視角
5. 輸出 Markdown 格式履歷，分段標題用 ## 標記
${quantifySection}

## 格式規範（嚴格遵守）
- **嚴格控制在 2 頁 A4 以內**（約 600-700 字，不可超過）
- 每條工作經歷最多 3 個 bullet points
- 每個 bullet point 最多 2 行
- 使用 Markdown 格式：
  - 主 bullet 用「- 」
  - 次級 bullet 用「  - 」（2 個空格縮排）
  - 段落標題用「## 」

## 輸出格式
## 基本資料
（姓名、聯絡方式，從原始履歷提取）

## 工作經歷
（STAR 格式，每條經歷最多 3 bullet points）

## 技能
（對齊 Persona 關鍵字，分類列出）

## 教育背景
（從原始履歷提取）`,
      },
      {
        role: 'user',
        content: `原始履歷：
${resumeMarkdown}

訪談中收集的額外資訊：
${contextSummary || '（無額外收集）'}

訪談對話摘錄：
${conversationSummary}

請生成優化後的履歷草稿，嚴格控制在 2 頁 A4 以內。`,
      },
    ],
    temperature: 0.4,
  })

  return response.choices[0].message.content ?? ''
}
