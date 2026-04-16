import { describe, it, expect } from 'vitest'

const SAMPLE_RESUME = `
张三 | Product Manager
5年產品管理經驗，主導過電商平台從 0 到 1，管理 DAU 200萬的產品線。
熟悉數據分析工具（GA、Mixpanel），曾帶領 8 人跨功能團隊。
負責 PRD 撰寫、用戶研究、A/B 測試設計。
`

describe('Persona API', () => {
  it('returns 2-3 recommendations with id and reason', async () => {
    const response = await fetch('http://localhost:3000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown: SAMPLE_RESUME }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data.recommendations)).toBe(true)
    expect(data.recommendations.length).toBeGreaterThanOrEqual(1)
    expect(data.recommendations.length).toBeLessThanOrEqual(3)
    expect(data.recommendations[0]).toHaveProperty('id')
    expect(data.recommendations[0]).toHaveProperty('reason')
  })

  it('returns 400 when resumeMarkdown is missing', async () => {
    const response = await fetch('http://localhost:3000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(400)
  })
})
