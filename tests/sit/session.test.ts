import { describe, it, expect } from 'vitest'
import { createServerClient } from '@/lib/supabase'

describe('Supabase session CRUD', () => {
  it('should create, read, update, and delete a session', async () => {
    const db = createServerClient()

    // Create
    const { data: created, error: createError } = await db
      .from('sessions')
      .insert({ resume_markdown: 'test resume', persona_id: 'pdm-mid' })
      .select()
      .single()
    expect(createError).toBeNull()
    expect(created.id).toBeTruthy()

    // Read
    const { data: read, error: readError } = await db
      .from('sessions')
      .select()
      .eq('id', created.id)
      .single()
    expect(readError).toBeNull()
    expect(read.resume_markdown).toBe('test resume')

    // Update
    const { error: updateError } = await db
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', created.id)
    expect(updateError).toBeNull()

    // Delete（測試後清理）
    await db.from('sessions').delete().eq('id', created.id)
  })
})
