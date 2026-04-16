import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getPersona } from '@/lib/persona/templates'
import { runMappingAgent } from '@/lib/agents/mapping-agent'
import { generateDocx } from '@/lib/docx-generator'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const db = createServerClient()
    const { data: session, error } = await db
      .from('sessions')
      .select()
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const persona = getPersona(session.persona_id)
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    const resumeText = await runMappingAgent({
      resumeMarkdown: session.resume_markdown,
      persona,
      collectedContext: session.collected_context ?? {},
      conversationHistory: session.conversation_history ?? [],
    })

    // Parse sections from markdown
    const sectionRegex = /##\s+(.+)\n([\s\S]*?)(?=\n##\s+|$)/g
    const sections: Array<{ title: string; content: string }> = []
    let match
    while ((match = sectionRegex.exec(resumeText)) !== null) {
      sections.push({ title: match[1].trim(), content: match[2].trim() })
    }

    const docxBuffer = await generateDocx('履歷', sections)
    const docxBase64 = docxBuffer.toString('base64')

    await db.from('sessions').update({
      docx_content: docxBase64,
      status: 'completed',
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)

    return NextResponse.json({ resumeText, sectionsCount: sections.length })
  } catch (error) {
    console.error('Mapping error:', error)
    return NextResponse.json({ error: 'Mapping failed' }, { status: 500 })
  }
}
