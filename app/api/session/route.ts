import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getPersona } from '@/lib/persona/templates'

export async function POST(req: NextRequest) {
  try {
    const { resumeMarkdown, personaId } = await req.json()

    if (!resumeMarkdown || !personaId) {
      return NextResponse.json(
        { error: 'resumeMarkdown and personaId are required' },
        { status: 400 }
      )
    }

    const persona = getPersona(personaId)
    if (!persona) {
      return NextResponse.json({ error: 'Invalid personaId' }, { status: 400 })
    }

    const db = createServerClient()
    const { data, error } = await db
      .from('sessions')
      .insert({
        resume_markdown: resumeMarkdown,
        persona_id: personaId,
        gaps_total: persona.interview_gaps.length,
        gaps_completed: 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ session: data }, { status: 201 })
  } catch (error) {
    console.error('Session create error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
