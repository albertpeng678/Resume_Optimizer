import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { getPersona } from '@/lib/persona/templates'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const db = createServerClient()
  const { data: session, error } = await db
    .from('sessions')
    .select()
    .eq('id', id)
    .single()

  if (error || !session) redirect('/')

  const persona = getPersona(session.persona_id)
  if (!persona) redirect('/')

  return (
    <ChatInterface
      sessionId={id}
      personaTitle={persona.title}
      gapsTotal={session.gaps_total ?? persona.interview_gaps.length}
      gapsCompleted={session.gaps_completed ?? 0}
      initialHistory={session.conversation_history ?? []}
      quantifyData={(session as any).quantify_data ?? []}
      interviewGaps={persona.interview_gaps}
    />
  )
}
