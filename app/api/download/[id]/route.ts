import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServerClient()
  const { data, error } = await db
    .from('sessions')
    .select('docx_content')
    .eq('id', id)
    .single()

  if (error || !data?.docx_content) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const buffer = Buffer.from(data.docx_content, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="resume.docx"',
      'Content-Length': buffer.length.toString(),
    },
  })
}
