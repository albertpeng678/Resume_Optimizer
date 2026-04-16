import { describe, it, expect } from 'vitest'
import { generateDocx } from '@/lib/docx-generator'
import { createServerClient } from '@/lib/supabase'

describe('DOCX Generator', () => {
  it('generates a valid DOCX buffer', async () => {
    const buffer = await generateDocx('Test User', [
      { title: '工作經歷', content: '曾任 PM，負責電商平台' },
      { title: '技能', content: 'JavaScript, SQL, Figma' },
    ])
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    // DOCX is ZIP format, first 4 bytes are PK\x03\x04
    expect(buffer[0]).toBe(0x50) // P
    expect(buffer[1]).toBe(0x4b) // K
  })
})

describe('Map API + Download API', () => {
  let sessionId: string

  it('setup: creates completed session with conversation', async () => {
    const db = createServerClient()
    const { data } = await db
      .from('sessions')
      .insert({
        resume_markdown: '5年PM，電商平台，帶8人團隊，DAU 200萬',
        persona_id: 'product-manager-mid',
        conversation_history: [
          { role: 'user', content: '我負責的產品 DAU 有 200 萬' },
          { role: 'assistant', content: '這個數字很有說服力！' },
        ],
        gaps_total: 8,
        gaps_completed: 8,
      })
      .select()
      .single()
    sessionId = data!.id
    expect(sessionId).toBeTruthy()
  })

  it('map API generates resume and saves DOCX', async () => {
    const response = await fetch('http://localhost:3000/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.resumeText).toBeTruthy()
    expect(data.sectionsCount).toBeGreaterThan(0)
  })

  it('download API returns valid DOCX file', async () => {
    const response = await fetch(`http://localhost:3000/api/download/${sessionId}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('wordprocessingml')
    const buffer = await response.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it('cleanup: deletes test session', async () => {
    const db = createServerClient()
    await db.from('sessions').delete().eq('id', sessionId)
  })
})
