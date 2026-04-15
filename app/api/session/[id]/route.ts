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
    .select()
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return NextResponse.json({ session: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const allowedFields = [
      'status',
      'collected_context',
      'conversation_history',
      'gaps_completed',
    ]
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    const db = createServerClient()
    const { data, error } = await db
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
