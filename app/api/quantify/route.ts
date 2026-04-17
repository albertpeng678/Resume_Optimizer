import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
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
  // TODO: Step 4 - Rewrite this route to use new formula suggestion API
  return NextResponse.json(
    { error: 'This endpoint will be rewritten in Step 4' },
    { status: 501 }
  )
}
