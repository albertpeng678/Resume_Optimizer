import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServerClient } from '@/lib/supabase'

const BASE_URL = 'http://localhost:3000'

describe('Quantify API (/api/quantify)', () => {
  let sessionId: string
  let entryIdFromRound1: string

  // ─── Setup ────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const db = createServerClient()
    const { data, error } = await db
      .from('sessions')
      .insert({
        resume_markdown: '5年產品經理，負責電商平台，帶領8人團隊',
        persona_id: 'product-manager-mid',
        gaps_total: 8,
        quantify_data: [],
      })
      .select()
      .single()

    if (error || !data) throw new Error('Setup: failed to create session')
    sessionId = data.id
  })

  afterAll(async () => {
    if (sessionId) {
      const db = createServerClient()
      await db.from('sessions').delete().eq('id', sessionId)
    }
  })

  // ─── Input validation ─────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'test', context: 'ctx', messages: [], roundNumber: 1, userMessage: 'hi' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when roundNumber is out of range (0)', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 't',
        context: 'c',
        messages: [],
        roundNumber: 0,
        userMessage: 'hi',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when roundNumber is out of range (6)', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 't',
        context: 'c',
        messages: [],
        roundNumber: 6,
        userMessage: 'hi',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages is not an array', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 't',
        context: 'c',
        messages: null,
        roundNumber: 1,
        userMessage: 'hi',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent sessionId', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '00000000-0000-0000-0000-000000000000',
        topic: 't',
        context: 'c',
        messages: [],
        roundNumber: 1,
        userMessage: '你好',
      }),
    })
    expect(res.status).toBe(404)
  })

  // ─── Round 1 ──────────────────────────────────────────────────────────────

  it('round 1: returns 200 with entryId and isComplete=false', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        context: '用戶說他負責的產品業績有明顯成長',
        messages: [],
        roundNumber: 1,
        userMessage: '我負責的產品在上半年業績有很大的成長',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.entryId).toBeTruthy()
    expect(data.roundNumber).toBe(1)
    expect(data.isComplete).toBe(false)
    expect(data.result).toBeNull()
    expect(data.assistantMessage.length).toBeGreaterThan(10)
    expect(data.assistantMessage).not.toContain('[QUANTIFY_RESULT]')
    expect(data.assistantMessage).not.toContain('[QUANTIFY_FAILED]')

    entryIdFromRound1 = data.entryId
  }, 30000)

  it('round 1 does NOT write to session.quantify_data', async () => {
    const db = createServerClient()
    const { data } = await db.from('sessions').select('quantify_data').eq('id', sessionId).single()
    expect(Array.isArray(data?.quantify_data)).toBe(true)
    expect(data?.quantify_data).toHaveLength(0)
  })

  // ─── Round 2-4 (spot check round 2) ──────────────────────────────────────

  it('round 2: echoes entryId and returns isComplete=false', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        context: '用戶說他負責的產品業績有明顯成長',
        messages: [{ role: 'assistant', content: '請問大概成長了多少，10%還是更多？' }],
        roundNumber: 2,
        userMessage: '大概有 30% 到 40% 的成長',
        entryId: entryIdFromRound1,
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.entryId).toBe(entryIdFromRound1)
    expect(data.isComplete).toBe(false)
    expect(data.result).toBeNull()
  }, 30000)

  it('round 2 does NOT write to session.quantify_data', async () => {
    const db = createServerClient()
    const { data } = await db.from('sessions').select('quantify_data').eq('id', sessionId).single()
    expect(data?.quantify_data).toHaveLength(0)
  })
})

describe('Quantify API - round 5 saves QuantifyEntry', () => {
  let sessionId: string

  beforeAll(async () => {
    const db = createServerClient()
    const { data, error } = await db
      .from('sessions')
      .insert({
        resume_markdown: '3年後端工程師，負責API開發',
        persona_id: 'software-engineer-mid',
        gaps_total: 8,
        quantify_data: [],
      })
      .select()
      .single()

    if (error || !data) throw new Error('Setup: failed to create session')
    sessionId = data.id
  })

  afterAll(async () => {
    if (sessionId) {
      const db = createServerClient()
      await db.from('sessions').delete().eq('id', sessionId)
    }
  })

  it('round 5: saves QuantifyEntry with result to quantify_data when LLM extracts a number', async () => {
    // Provide a conversation history that should lead the LLM to produce a quantified result
    const messages = [
      { role: 'assistant', content: '請問你優化前後 API 響應時間大約快了多少？' },
      { role: 'user', content: '快了大概一半吧' },
      { role: 'assistant', content: '也就是說縮短了 50% 左右？請問原本是多少毫秒？' },
      { role: 'user', content: '原本大約 200ms，現在大約 100ms' },
      { role: 'assistant', content: '所以確實是快了 50%，這是個很好的量化數字' },
      { role: 'user', content: '對，可以這樣說' },
      { role: 'assistant', content: '讓我整合所有資訊做出最終判斷' },
    ]

    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'performance_impact',
        context: '工程師說他優化了 API 響應時間',
        messages,
        roundNumber: 5,
        userMessage: '是的，從 200ms 降到 100ms，縮短了 50%',
        entryId: 'test-entry-id-12345',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.isComplete).toBe(true)
    expect(data.entryId).toBe('test-entry-id-12345')
    // Result may or may not be found depending on LLM - just verify structure
    // (We can't guarantee the LLM outputs [QUANTIFY_RESULT] format perfectly in SIT)
    expect(typeof data.assistantMessage).toBe('string')
    expect(data.assistantMessage.length).toBeGreaterThan(5)

    // Verify entry was written to Supabase regardless of result
    const db = createServerClient()
    const { data: session } = await db
      .from('sessions')
      .select('quantify_data')
      .eq('id', sessionId)
      .single()

    expect(Array.isArray(session?.quantify_data)).toBe(true)
    expect(session?.quantify_data).toHaveLength(1)

    const entry = session?.quantify_data[0]
    expect(entry.id).toBe('test-entry-id-12345')
    expect(entry.topic).toBe('performance_impact')
    expect(entry.completedAt).toBeTruthy()
    expect(Array.isArray(entry.rounds)).toBe(true)
    // result can be null (if LLM didn't produce [QUANTIFY_RESULT]) or an object
    expect(entry.result === null || typeof entry.result === 'object').toBe(true)
  }, 60000)
})
