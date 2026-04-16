import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { buildCareerAdvisorPrompt, parseGapStatus, stripGapStatus } from '@/lib/agents/career-advisor'
import { getPersona } from '@/lib/persona/templates'
import { createServerClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { sessionId, userMessage } = await req.json()

  const db = createServerClient()
  const { data: session, error } = await db
    .from('sessions')
    .select()
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
  }

  const persona = getPersona(session.persona_id)
  if (!persona) {
    return new Response(JSON.stringify({ error: 'Persona not found' }), { status: 404 })
  }

  const systemPrompt = buildCareerAdvisorPrompt(persona, session.resume_markdown)
  const history = session.conversation_history as Array<{ role: string; content: string }>

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
    temperature: 0.7,
  })

  let fullContent = ''

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        fullContent += delta
        const displayDelta = delta.includes('[GAPS_STATUS]') ? '' : delta
        if (displayDelta) {
          controller.enqueue(encoder.encode(displayDelta))
        }
      }

      const gapStatus = parseGapStatus(fullContent)
      const cleanContent = stripGapStatus(fullContent)
      const updatedHistory = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: cleanContent },
      ]

      await db.from('sessions').update({
        conversation_history: updatedHistory,
        gaps_completed: gapStatus?.completed.length ?? session.gaps_completed,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId)

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
