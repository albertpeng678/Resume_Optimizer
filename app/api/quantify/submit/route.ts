import { NextRequest, NextResponse } from 'next/server'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'
import { createServerClient } from '@/lib/supabase'

interface SubmitRequest {
  sessionId: string
  entryId: string
  topic: string
  context: string
  formulaId: string
  variables: Record<string, string>
  computedResult: string
  traceLog: string
}

export async function POST(req: NextRequest) {
  let body: SubmitRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionId, entryId, topic, context, formulaId, variables, computedResult, traceLog } = body

  // Validate all required fields
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }
  if (!entryId || typeof entryId !== 'string') {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
  }
  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }
  if (!context || typeof context !== 'string') {
    return NextResponse.json({ error: 'context is required' }, { status: 400 })
  }
  if (!formulaId || typeof formulaId !== 'string') {
    return NextResponse.json({ error: 'formulaId is required' }, { status: 400 })
  }
  if (!variables || typeof variables !== 'object') {
    return NextResponse.json({ error: 'variables is required' }, { status: 400 })
  }
  if (!computedResult || typeof computedResult !== 'string') {
    return NextResponse.json({ error: 'computedResult is required' }, { status: 400 })
  }
  if (!traceLog || typeof traceLog !== 'string') {
    return NextResponse.json({ error: 'traceLog is required' }, { status: 400 })
  }

  const db = createServerClient()

  // Fetch session
  const { data: session, error: fetchError } = await db
    .from('sessions')
    .select('quantify_data')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Build new entry
  const entry: QuantifyEntry = {
    id: entryId,
    topic,
    context,
    result: {
      number: computedResult,
      metric: formulaId,
      background: traceLog,
    },
    rounds: [],
    completedAt: new Date().toISOString(),
  }

  // Append to existing quantify_data
  const existingData = session.quantify_data ?? []
  const updatedData = [...existingData, entry]

  // Update session
  const { error: updateError } = await db
    .from('sessions')
    .update({ quantify_data: updatedData })
    .eq('id', sessionId)

  if (updateError) {
    console.error('Failed to update session:', updateError)
    return NextResponse.json(
      { error: 'Failed to save quantify data' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
