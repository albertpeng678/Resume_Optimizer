import { describe, it, expect } from 'vitest'
import { createServerClient } from '@/lib/supabase'

describe('Chat API (Career Advisor)', () => {
  let sessionId: string

  it('setup: creates a test session', async () => {
    const db = createServerClient()
    const { data } = await db
      .from('sessions')
      .insert({
        resume_markdown: '5年產品經理，負責電商平台，帶領8人團隊',
        persona_id: 'product-manager-mid',
        gaps_total: 8,
      })
      .select()
      .single()
    sessionId = data!.id
    expect(sessionId).toBeTruthy()
  })

  it('returns streaming response for valid session', async () => {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userMessage: '你好，我想開始優化我的履歷',
      }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    expect(text.length).toBeGreaterThan(10)
    expect(text).not.toContain('[GAPS_STATUS]')
  })

  it('returns 404 for invalid session', async () => {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '00000000-0000-0000-0000-000000000000',
        userMessage: 'hello',
      }),
    })
    expect(response.status).toBe(404)
  })

  it('cleanup: deletes test session', async () => {
    const db = createServerClient()
    await db.from('sessions').delete().eq('id', sessionId)
  })
})
