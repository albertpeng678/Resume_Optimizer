import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCareerList } from '@/lib/persona/templates'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { resumeMarkdown } = await req.json()

    if (!resumeMarkdown || typeof resumeMarkdown !== 'string' || !resumeMarkdown.trim()) {
      return NextResponse.json({ error: 'resumeMarkdown is required' }, { status: 400 })
    }

    const careers = getCareerList()
    const validCareers = new Set(careers.map((c) => c.id))
    const careerList = careers
      .map((c) => `- career: "${c.id}", title: "${c.title}"`)
      .join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `你是一位資深職涯顧問。根據用戶的履歷內容，從以下職位類別中推薦最適合的 3 個，並給出簡短理由（一句話）。

可選職位類別：
${careerList}

請以 JSON 格式回應：
{
  "recommendations": [
    { "career": "career-id", "title": "職位中文名", "reason": "一句話說明為什麼推薦" }
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

    if (!Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid OpenAI response: missing recommendations array')
    }
    parsed.recommendations = parsed.recommendations
      .filter(
        (r: any) =>
          r &&
          typeof r.career === 'string' &&
          typeof r.reason === 'string' &&
          validCareers.has(r.career)
      )
      .map((r: any) => ({
        career: r.career,
        title: careers.find((c) => c.id === r.career)?.title ?? r.title,
        reason: r.reason,
      }))
      .slice(0, 3)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Persona recommendation error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
