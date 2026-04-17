import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import {
  FormulaTemplate,
  buildFormulaSuggestionPrompt,
} from '@/lib/agents/quantify-advisor'
import { createServerClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface QuantifyRequest {
  sessionId: string
  topic: string
  context: string
  original_text: string
  formula_hint: string
}

interface QuantifyResponse {
  formulas: FormulaTemplate[]
  entryId: string
}

export async function POST(req: NextRequest) {
  let body: QuantifyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionId, topic, context, original_text, formula_hint } = body

  // Validate all required fields
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }
  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }
  if (!context || typeof context !== 'string') {
    return NextResponse.json({ error: 'context is required' }, { status: 400 })
  }
  if (!original_text || typeof original_text !== 'string') {
    return NextResponse.json({ error: 'original_text is required' }, { status: 400 })
  }
  if (!formula_hint || typeof formula_hint !== 'string') {
    return NextResponse.json({ error: 'formula_hint is required' }, { status: 400 })
  }

  // Verify session exists
  const db = createServerClient()
  const { data: session, error: sessionError } = await db
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Build prompt and call OpenAI
  const prompt = buildFormulaSuggestionPrompt(topic, context, original_text, formula_hint)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const responseText = response.choices[0].message.content
    if (!responseText) {
      return NextResponse.json(
        { error: 'Empty response from OpenAI' },
        { status: 500 }
      )
    }

    // Parse JSON response
    let formulas: FormulaTemplate[]
    try {
      formulas = JSON.parse(responseText)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse formula suggestions' },
        { status: 500 }
      )
    }

    // Validate that formulas is an array
    if (!Array.isArray(formulas)) {
      return NextResponse.json(
        { error: 'Failed to parse formula suggestions' },
        { status: 500 }
      )
    }

    // Generate entry ID
    const entryId = randomUUID()

    const result: QuantifyResponse = {
      formulas,
      entryId,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json(
      { error: 'Failed to call OpenAI API' },
      { status: 500 }
    )
  }
}
