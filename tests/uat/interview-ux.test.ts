import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createServerClient } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

const BASE_URL = 'http://localhost:3000'
const PDF_PATH = path.join(process.cwd(), '彭敬鈞履歷.pdf')

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

let sessionId: string
let resumeMarkdown: string
let personaId: string

describe('UAT: Interview UX — Full Flow with 彭敬鈞履歷.pdf', () => {
  beforeAll(async () => {
    const serverUp = await checkServer()
    if (!serverUp) {
      console.warn('Dev server not running — skipping UAT tests')
    }
  }, 10000)

  afterAll(async () => {
    if (!sessionId) return
    const db = createServerClient()
    await db.from('sessions').delete().eq('id', sessionId)
  })

  it('skips gracefully when dev server not running', async () => {
    const serverUp = await checkServer()
    if (!serverUp) {
      expect(true).toBe(true)
      return
    }
    expect(serverUp).toBe(true)
  })

  it('uploads 彭敬鈞履歷.pdf and returns resume markdown', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    expect(fs.existsSync(PDF_PATH)).toBe(true)

    const formData = new FormData()
    formData.append('file', fs.createReadStream(PDF_PATH), {
      filename: '彭敬鈞履歷.pdf',
      contentType: 'application/pdf',
    })

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers: formData.getHeaders(),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.markdown).toBe('string')
    expect(data.markdown.length).toBeGreaterThan(100)
    resumeMarkdown = data.markdown
    console.log('Resume markdown length:', resumeMarkdown.length)
  }, 30000)

  it('recommends relevant personas from resume', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !resumeMarkdown) return

    const res = await fetch(`${BASE_URL}/api/persona`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.recommendations)).toBe(true)
    expect(data.recommendations.length).toBeGreaterThanOrEqual(1)
    const first = data.recommendations[0]
    expect(typeof first.career).toBe('string')
    expect(typeof first.title).toBe('string')
    expect(typeof first.reason).toBe('string')
    personaId = `${first.career}-mid`
    console.log('Recommended persona:', personaId)
  }, 30000)

  it('creates session successfully', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !resumeMarkdown || !personaId) return

    const res = await fetch(`${BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown, personaId }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.session.id).toBe('string')
    expect(data.session.gaps_total).toBeGreaterThan(0)
    sessionId = data.session.id
    console.log('Session created:', sessionId, 'gaps_total:', data.session.gaps_total)
  }, 10000)

  it('AI first message contains N-topic list announcement', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userMessage: '你好，請開始訪談',
      }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    let fullAssistantContent = ''
    let gotReplaceEvent = false

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(6)
        if (!dataLine) continue
        if (eventType === 'replace') {
          fullAssistantContent = JSON.parse(dataLine)
          gotReplaceEvent = true
        }
      }
    }

    expect(gotReplaceEvent).toBe(true)
    expect(fullAssistantContent.length).toBeGreaterThan(50)

    const hasTopicAnnouncement =
      fullAssistantContent.includes('個主題') ||
      fullAssistantContent.includes('個問題')
    expect(hasTopicAnnouncement).toBe(true)

    const isTooGeneric = fullAssistantContent.length < 30
    expect(isTooGeneric).toBe(false)

    console.log('AI first message preview:', fullAssistantContent.slice(0, 200))
  }, 60000)

  it('QUANTIFY_TRIGGER fires when user describes a quantifiable achievement', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const quantifiableMessage =
      '我主導這個專案後，整個團隊的效率提升了非常多，處理速度也加快了很多，用戶滿意度也顯著改善了'

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userMessage: quantifiableMessage }),
    })

    expect(res.status).toBe(200)

    let gotTrigger = false
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        if (eventType === 'trigger') gotTrigger = true
      }
    }

    expect(gotTrigger).toBe(true)
    console.log('QUANTIFY_TRIGGER fired correctly')
  }, 60000)

  it('quantify round 1 response contains bounded example numbers', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: '專案效率提升',
        context: '用戶說效率提升了非常多，處理速度加快了很多',
        messages: [],
        roundNumber: 1,
        userMessage: '我讓團隊處理速度提升了很多',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.assistantMessage).toBe('string')
    expect(data.isComplete).toBe(false)

    const hasNumericExample = /\d+(%|倍|分鐘|小時|天|件|人|萬)/.test(data.assistantMessage)
    expect(hasNumericExample).toBe(true)

    console.log('Round 1 response preview:', data.assistantMessage.slice(0, 200))
  }, 30000)

  it('session state is retrievable for resume', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/session/${sessionId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(sessionId)
    expect(Array.isArray(data.conversation_history)).toBe(true)
    expect(data.conversation_history.length).toBeGreaterThan(0)
    console.log('Session has', data.conversation_history.length, 'messages, gaps_completed:', data.gaps_completed)
  }, 10000)

  it('SSE response does not buffer — emits text events in real time', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const start = Date.now()
    let firstChunkTime: number | null = null

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userMessage: '繼續' }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        if (eventType === 'text' && firstChunkTime === null) {
          firstChunkTime = Date.now() - start
          break outer
        }
      }
    }

    expect(firstChunkTime).not.toBeNull()
    expect(firstChunkTime!).toBeLessThan(5000)
    console.log('First SSE chunk received after', firstChunkTime, 'ms')

    try { await res.body?.cancel() } catch { /* ignore */ }
  }, 30000)

  it('returns 404 for invalid sessionId', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'invalid-session-id-000', userMessage: 'test' }),
    })
    expect(res.status).toBe(404)
  })

  it('upload rejects unsupported file type', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    const formData = new FormData()
    formData.append('file', Buffer.from('not a resume'), {
      filename: 'test.txt',
      contentType: 'text/plain',
    })

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers: formData.getHeaders(),
    })
    expect(res.status).toBe(400)
  })
}, 300000)
