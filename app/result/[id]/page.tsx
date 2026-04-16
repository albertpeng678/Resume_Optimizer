import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { ResumePreview } from '@/components/result/ResumePreview'

export default async function ResultPage({
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

  if (error || !session || !session.resume_text) redirect('/')

  return (
    <ResumePreview
      sessionId={id}
      resumeText={session.resume_text}
      quantifyData={session.quantify_data ?? []}
    />
  )
}
