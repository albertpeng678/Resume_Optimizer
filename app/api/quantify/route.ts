import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  buildQuantifyAdvisorPrompt,
  parseQuantifyResponse,
  QuantifyEntry,
  QuantifyResult,
} from '@/lib/agents/quantify-advisor'
import { createServerClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface QuantifyRequest {
  sessionId: string
  topic: string
  context: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  roundNumber: number
  userMessage: string
  entryId?: string
}

interface QuantifyResponse {
  assistantMessage: string
  roundNumber: number
  isComplete: boolean
  result: QuantifyResult | null
  entryId: string
}

export async function POST(req: NextRequest) {
  let body: QuantifyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionId, topic, context, messages, roundNumber, userMessage, entryId } = body

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }
  if (!topic || !context || !userMessage) {
    return NextResponse.json({ error: 'topic, context, and userMessage are required' }, { status: 400 })
  }
  if (!roundNumber || roundNumber < 1 || roundNumber > 5) {
    return NextResponse.json({ error: 'roundNumber must be 1-5' }, { status: 400 })
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: session, error } = await db
    .from('sessions')
    .select('quantify_data')
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Assign or reuse entry ID
  const currentEntryId = roundNumber === 1
    ? crypto.randomUUID()
    : (entryId ?? crypto.randomUUID())

  // Build messages for OpenAI
  const systemPrompt = buildQuantifyAdvisorPrompt(topic, context, roundNumber)
  const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  let rawContent: string
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      temperature: 0.3,
    })
    rawContent = response.choices[0].message.content ?? ''
  } catch (err) {
    console.error('Quantify OpenAI error:', err)
    return NextResponse.json({ error: 'LLM call failed' }, { status: 500 })
  }

  const { cleanContent, outcome } = parseQuantifyResponse(rawContent, roundNumber)
  const isComplete = roundNumber === 5
  let result: QuantifyResult | null = null

  if (isComplete) {
    if (outcome.type === 'result') {
      result = outcome.data
    }

    // Build and save the QuantifyEntry to Supabase
    const roundHistory = [
      ...messages,
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: cleanContent },
    ]

    const newEntry: QuantifyEntry = {
      id: currentEntryId,
      topic,
      context,
      result,
      rounds: roundHistory,
      completedAt: new Date().toISOString(),
    }

    const existingData = (session.quantify_data ?? []) as QuantifyEntry[]
    const { error: updateError } = await db.from('sessions').update({
      quantify_data: [...existingData, newEntry],
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save quantify entry:', updateError)
      return NextResponse.json({ error: 'Failed to save quantify data' }, { status: 500 })
    }
  }

  const responseBody: QuantifyResponse = {
    assistantMessage: cleanContent,
    roundNumber,
    isComplete,
    result,
    entryId: currentEntryId,
  }

  return NextResponse.json(responseBody)
}
