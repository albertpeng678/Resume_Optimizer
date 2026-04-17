/**
 * SIT tests for Quantify API (formula suggestion flow)
 *
 * NOTE: `quantify_data` is a JSONB column that must exist in the `sessions` table.
 * If it does not exist, run the following migration in Supabase SQL editor:
 *   ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quantify_data jsonb DEFAULT '[]';
 *
 * These tests call real HTTP endpoints (requires `npm run dev`) and the real
 * Supabase instance. OpenAI is also called for the /api/quantify endpoint.
 * Ensure OPENAI_API_KEY is set in .env.local before running.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServerClient } from '@/lib/supabase'

const BASE_URL = 'http://localhost:3000'

describe('Quantify API — formula suggestion flow', () => {
  let sessionId: string
  let entryId: string

  // ─── Setup ─────────────────────────────────────────────────────────────────

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

    if (error || !data) throw new Error(`Setup: failed to create session — ${error?.message}`)
    sessionId = data.id
  })

  afterAll(async () => {
    if (sessionId) {
      const db = createServerClient()
      await db.from('sessions').delete().eq('id', sessionId)
    }
  })

  // ─── /api/quantify input validation ────────────────────────────────────────

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
      body: JSON.stringify({
        topic: 'revenue_impact',
        context: '產品業績有明顯成長',
        original_text: '我負責的產品業績有很大的成長',
        formula_hint: 'percentage_growth',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when topic is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        context: '產品業績有明顯成長',
        original_text: '我負責的產品業績有很大的成長',
        formula_hint: 'percentage_growth',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when context is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        original_text: '我負責的產品業績有很大的成長',
        formula_hint: 'percentage_growth',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when original_text is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        context: '產品業績有明顯成長',
        formula_hint: 'percentage_growth',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when formula_hint is missing', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        context: '產品業績有明顯成長',
        original_text: '我負責的產品業績有很大的成長',
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
        topic: 'revenue_impact',
        context: '產品業績有明顯成長',
        original_text: '我負責的產品業績有很大的成長',
        formula_hint: 'percentage_growth',
      }),
    })
    expect(res.status).toBe(404)
  })

  // ─── /api/quantify happy path ───────────────────────────────────────────────

  it('returns formulas array and entryId for valid request', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: 'revenue_impact',
        context: '用戶說他負責的產品業績在上半年有明顯成長',
        original_text: '我負責的產品在上半年業績有很大的成長',
        formula_hint: 'percentage_growth',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()

    // Verify response shape
    expect(Array.isArray(data.formulas)).toBe(true)
    expect(data.formulas.length).toBeGreaterThan(0)
    expect(typeof data.entryId).toBe('string')
    expect(data.entryId.length).toBeGreaterThan(0)

    // Verify each formula has required fields
    const formula = data.formulas[0]
    expect(formula).toHaveProperty('id')
    expect(formula).toHaveProperty('label')
    expect(formula).toHaveProperty('variables')
    expect(Array.isArray(formula.variables)).toBe(true)

    // Save entryId for submit test
    entryId = data.entryId
  }, 30000)

  // ─── /api/quantify/submit input validation ─────────────────────────────────

  it('submit: returns 400 for invalid JSON body', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(400)
  })

  it('submit: returns 400 when variables is an array (not an object)', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        entryId: 'some-entry-id',
        topic: 'revenue_impact',
        context: '產品業績成長',
        formulaId: 'percentage_growth',
        variables: ['not', 'an', 'object'],
        computedResult: '30%',
        traceLog: 'growth / base * 100 = 30%',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('submit: returns 404 for non-existent sessionId', async () => {
    const res = await fetch(`${BASE_URL}/api/quantify/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '00000000-0000-0000-0000-000000000000',
        entryId: 'some-entry-id',
        topic: 'revenue_impact',
        context: '產品業績成長',
        formulaId: 'percentage_growth',
        variables: { growth: '300', base: '1000' },
        computedResult: '30%',
        traceLog: 'growth / base * 100 = 30%',
      }),
    })
    expect(res.status).toBe(404)
  })

  // ─── /api/quantify/submit happy path ───────────────────────────────────────

  it('submit: saves quantify entry and returns { ok: true }', async () => {
    // entryId is set by the previous /api/quantify happy-path test
    expect(entryId).toBeTruthy()

    const res = await fetch(`${BASE_URL}/api/quantify/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        entryId,
        topic: 'revenue_impact',
        context: '用戶說他負責的產品業績在上半年有明顯成長',
        formulaId: 'percentage_growth',
        variables: { growth: '300', base: '1000' },
        computedResult: '30%',
        traceLog: '(300 / 1000) * 100 = 30%',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  // ─── Supabase quantify_data persistence check ──────────────────────────────

  it('quantify_data in Supabase is updated after submit', async () => {
    const db = createServerClient()
    const { data: session, error } = await db
      .from('sessions')
      .select('quantify_data')
      .eq('id', sessionId)
      .single()

    // If quantify_data column doesn't exist, this will error — add the column via migration
    expect(error).toBeNull()
    expect(Array.isArray(session?.quantify_data)).toBe(true)
    expect(session!.quantify_data).toHaveLength(1)

    const entry = session!.quantify_data[0]
    expect(entry.id).toBe(entryId)
    expect(entry.topic).toBe('revenue_impact')
    expect(entry.completedAt).toBeTruthy()
  })
})
