import { describe, it, expect, afterEach } from 'vitest'
import { createServerClient } from '@/lib/supabase'

describe('Supabase session CRUD', () => {
  let createdId: string | null = null
  const db = createServerClient()

  afterEach(async () => {
    if (createdId) {
      await db.from('sessions').delete().eq('id', createdId)
      createdId = null
    }
  })

  it('should create, read, update, and delete a session', async () => {
    // Create
    const { data: created, error: createError } = await db
      .from('sessions')
      .insert({ resume_markdown: 'test resume', persona_id: 'pdm-mid' })
      .select()
      .single()
    expect(createError).toBeNull()
    expect(created).not.toBeNull()
    expect(created!.id).toBeTruthy()
    createdId = created!.id

    // Read
    const { data: read, error: readError } = await db
      .from('sessions')
      .select()
      .eq('id', createdId)
      .single()
    expect(readError).toBeNull()
    expect(read!.resume_markdown).toBe('test resume')
    expect(read!.status).toBe('in_progress')

    // Update
    const { error: updateError } = await db
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', createdId)
    expect(updateError).toBeNull()

    // Verify update took effect
    const { data: updated } = await db
      .from('sessions')
      .select('status')
      .eq('id', createdId)
      .single()
    expect(updated!.status).toBe('completed')
  })
})
