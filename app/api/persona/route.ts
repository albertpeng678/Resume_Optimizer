import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAllPersonas } from '@/lib/persona/templates'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { resumeMarkdown } = await req.json()

    if (!resumeMarkdown || typeof resumeMarkdown !== 'string') {
      return NextResponse.json({ error: 'resumeMarkdown is required' }, { status: 400 })
    }

    const personas = getAllPersonas()
    const personaList = personas
      .map(p => `- id: "${p.id}", title: "${p.title}", years: ${p.years}`)
      .join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `你是一位資深職涯顧問。根據用戶的履歷內容，從以下 Persona 中推薦最適合的 2-3 個，並給出簡短理由（一句話）。

可選 Persona：
${personaList}

請以 JSON 格式回應：
{
  "recommendations": [
    { "id": "persona-id", "reason": "一句話說明為什麼推薦" }
  ]
}`,
        },
        {
          role: 'user',
          content: `以下是我的履歷：\n\n${resumeMarkdown.slice(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Persona recommendation error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
