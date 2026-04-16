import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getPersona } from '@/lib/persona/templates'
import { runMappingAgent } from '@/lib/agents/mapping-agent'
import { generateDocx } from '@/lib/docx-generator'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

function parseSections(text: string): Array<{ title: string; content: string }> {
  const sectionRegex = /##\s+(.+)\n([\s\S]*?)(?=\n##\s+|$)/g
  const sections: Array<{ title: string; content: string }> = []
  let match
  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ title: match[1].trim(), content: match[2].trim() })
  }
  return sections
}

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

    // Run mapping agent with quantify data for traceable number tags
    const resumeText = await runMappingAgent({
      resumeMarkdown: session.resume_markdown,
      persona,
      collectedContext: session.collected_context ?? {},
      conversationHistory: session.conversation_history ?? [],
      quantifyData: (session.quantify_data ?? []) as QuantifyEntry[],
    })

    // Generate DOCX from tag-stripped version (plain numbers for Word doc)
    const docxCleanText = resumeText.replace(/\[Q:[^\]]+\](.*?)\[\/Q\]/g, '$1')
    const sections = parseSections(docxCleanText)
    const docxBuffer = await generateDocx('履歷', sections)
    const docxBase64 = docxBuffer.toString('base64')

    // Store both versions: resume_text (with [Q:id] tags for preview) + docx (stripped)
    await db.from('sessions').update({
      docx_content: docxBase64,
      resume_text: resumeText,
      status: 'completed',
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)

    return NextResponse.json({ resumeText: docxCleanText, sectionsCount: sections.length })
  } catch (error) {
    console.error('Mapping error:', error)
    return NextResponse.json({ error: 'Mapping failed' }, { status: 500 })
  }
}
