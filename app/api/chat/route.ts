import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import {
  buildCareerAdvisorPrompt,
  parseGapStatus,
  stripGapStatus,
  parseQuantifyTrigger,
  stripQuantifyTrigger,
} from '@/lib/agents/career-advisor'
import { getPersona } from '@/lib/persona/templates'
import { createServerClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function sseEvent(eventType: string, data: string): string {
  return `event: ${eventType}\ndata: ${data}\n\n`
}

export async function POST(req: NextRequest) {
  // Input validation
  let body: { sessionId?: string; userMessage?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { sessionId, userMessage } = body
  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(JSON.stringify({ error: 'sessionId is required' }), { status: 400 })
  }
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return new Response(JSON.stringify({ error: 'userMessage is required' }), { status: 400 })
  }

  let db: ReturnType<typeof createServerClient>
  let session: any
  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>

  try {
    db = createServerClient()
    const { data, error } = await db
      .from('sessions')
      .select()
      .eq('id', sessionId)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
    }
    session = data

    const persona = getPersona(session.persona_id)
    if (!persona) {
      return new Response(JSON.stringify({ error: 'Persona not found' }), { status: 404 })
    }

    const systemPrompt = buildCareerAdvisorPrompt(persona, session.resume_markdown)
    const history = (session.conversation_history ?? []) as Array<{
      role: string
      content: string
    }>

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      stream: true,
      temperature: 0.7,
    })
  } catch (error) {
    console.error('Chat setup error:', error)
    return new Response(JSON.stringify({ error: 'Failed to start chat' }), { status: 500 })
  }

  const history = (session.conversation_history ?? []) as Array<{
    role: string
    content: string
  }>

  // Stream SSE response, accumulate full content
  // Hold back streaming until we have complete lines (to filter metadata lines at the end)
  let fullContent = ''
  let flushedUpTo = 0
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || ''
          fullContent += delta

          // Stream all complete lines except the last (which might contain metadata)
          // Also strip [QUANTIFY_TRIGGER] lines eagerly to prevent them leaking as visible text
          const lastNewline = fullContent.lastIndexOf('\n', fullContent.length - 1)
          if (lastNewline > flushedUpTo) {
            const toFlush = fullContent.slice(flushedUpTo, lastNewline + 1)
            const filteredFlush = toFlush.replace(/\[QUANTIFY_TRIGGER\]:\s*\{[^\n]+\}\n?/g, '')
            if (filteredFlush) {
              controller.enqueue(encoder.encode(sseEvent('text', JSON.stringify(filteredFlush))))
            }
            flushedUpTo = lastNewline + 1
          }
        }

        // Process remaining content: strip both [GAPS_STATUS] and [QUANTIFY_TRIGGER]
        const remaining = fullContent.slice(flushedUpTo)
        const cleanRemaining = stripGapStatus(stripQuantifyTrigger(remaining)).trimEnd()
        if (cleanRemaining) {
          controller.enqueue(encoder.encode(sseEvent('text', JSON.stringify(cleanRemaining))))
        }

        // Parse metadata from full content
        const gapStatus = parseGapStatus(fullContent)
        const quantifyTrigger = parseQuantifyTrigger(fullContent)

        // Build clean content for Supabase storage (strip all metadata)
        const cleanContent = stripGapStatus(stripQuantifyTrigger(fullContent)).trim()

        // Emit trigger event if present
        if (quantifyTrigger) {
          controller.enqueue(
            encoder.encode(sseEvent('trigger', JSON.stringify(quantifyTrigger)))
          )
        }

        // Emit done event
        controller.enqueue(encoder.encode(sseEvent('done', '')))

        // Update Supabase with clean content
        const updatedHistory = [
          ...history,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: cleanContent },
        ]

        const updateData: Record<string, unknown> = {
          conversation_history: updatedHistory,
          gaps_completed: gapStatus?.completed.length ?? session.gaps_completed,
          updated_at: new Date().toISOString(),
        }
        if (
          gapStatus &&
          session.gaps_total &&
          gapStatus.completed.length >= session.gaps_total
        ) {
          updateData.status = 'completed'
        }

        await db!.from('sessions').update(updateData).eq('id', sessionId)
      } catch (err) {
        console.error('Chat stream error:', err)
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
