import OpenAI from 'openai'
import { PersonaTemplate } from '@/lib/persona/templates'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface MappingInput {
  resumeMarkdown: string
  persona: PersonaTemplate
  collectedContext: Record<string, string>
  conversationHistory: Array<{ role: string; content: string }>
}

export async function runMappingAgent(input: MappingInput): Promise<string> {
  const { resumeMarkdown, persona, collectedContext, conversationHistory } = input

  const contextSummary = Object.entries(collectedContext)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  const conversationSummary = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-20)
    .map(m => m.content)
    .join('\n---\n')

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
2. 數字化成果（用訪談中收集到的數字）
3. 對齊 Persona 關鍵字（自然融入，不硬塞）
4. 用「解決問題」視角，而非「我做了什麼」視角
5. 輸出純文字履歷草稿，分段標題用 ## 標記

## 輸出格式
## 基本資料
（從原始履歷提取）

## 工作經歷
（STAR 格式，每條經歷最多 3-4 行）

## 技能
（對齊 Persona 關鍵字）

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

請生成優化後的履歷草稿。`,
      },
    ],
    temperature: 0.4,
  })

  return response.choices[0].message.content ?? ''
}
