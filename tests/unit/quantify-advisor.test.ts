import { describe, it, expect } from 'vitest'
import {
  buildQuantifyAdvisorPrompt,
  parseQuantifyResponse,
} from '@/lib/agents/quantify-advisor'

describe('buildQuantifyAdvisorPrompt', () => {
  it('includes topic and context in prompt', () => {
    const prompt = buildQuantifyAdvisorPrompt('revenue_impact', '用戶描述了Q3業績成長', 1)
    expect(prompt).toContain('revenue_impact')
    expect(prompt).toContain('用戶描述了Q3業績成長')
  })

  it('includes current round number in prompt', () => {
    const prompt1 = buildQuantifyAdvisorPrompt('topic', 'ctx', 1)
    const prompt3 = buildQuantifyAdvisorPrompt('topic', 'ctx', 3)
    expect(prompt1).toContain('第 1 輪')
    expect(prompt3).toContain('第 3 輪')
  })

  it('includes 5-round limit in prompt', () => {
    const prompt = buildQuantifyAdvisorPrompt('topic', 'ctx', 2)
    expect(prompt).toContain('共 5 輪')
  })

  it('prohibits fabrication in prompt', () => {
    const prompt = buildQuantifyAdvisorPrompt('topic', 'ctx', 1)
    expect(prompt).toContain('禁止')
  })
})

describe('parseQuantifyResponse', () => {
  describe('rounds 1-4 always return continue', () => {
    it('round 1 returns continue regardless of content', () => {
      const { outcome } = parseQuantifyResponse('some response', 1)
      expect(outcome.type).toBe('continue')
    })

    it('round 2 returns continue even if content contains QUANTIFY_RESULT', () => {
      const content = '回答\n[QUANTIFY_RESULT]: {"number":"30","metric":"%","background":"test"}'
      const { outcome } = parseQuantifyResponse(content, 2)
      expect(outcome.type).toBe('continue')
    })

    it('round 4 returns continue', () => {
      const { outcome } = parseQuantifyResponse('[QUANTIFY_FAILED]', 4)
      expect(outcome.type).toBe('continue')
    })
  })

  describe('round 5 - success path', () => {
    it('parses valid QUANTIFY_RESULT JSON and returns result type', () => {
      const content = '根據你的描述，我整理出以下數字。\n[QUANTIFY_RESULT]: {"number":"30","metric":"% 縮短導入時間","background":"從7天縮至5天"}'
      const { outcome } = parseQuantifyResponse(content, 5)
      expect(outcome.type).toBe('result')
      if (outcome.type === 'result') {
        expect(outcome.data.number).toBe('30')
        expect(outcome.data.metric).toBe('% 縮短導入時間')
        expect(outcome.data.background).toBe('從7天縮至5天')
      }
    })

    it('strips [QUANTIFY_RESULT] line from cleanContent', () => {
      const content = '訪談摘要。\n[QUANTIFY_RESULT]: {"number":"50","metric":"%","background":"test"}'
      const { cleanContent } = parseQuantifyResponse(content, 5)
      expect(cleanContent).not.toContain('[QUANTIFY_RESULT]')
      expect(cleanContent).toContain('訪談摘要')
    })

    it('preserves non-metadata content in cleanContent', () => {
      const content = '第一行\n第二行\n[QUANTIFY_RESULT]: {"number":"10","metric":"件","background":"b"}'
      const { cleanContent } = parseQuantifyResponse(content, 5)
      expect(cleanContent).toContain('第一行')
      expect(cleanContent).toContain('第二行')
    })
  })

  describe('round 5 - failure path', () => {
    it('returns failed type when [QUANTIFY_FAILED] present', () => {
      const content = '很抱歉無法找到具體數字。\n[QUANTIFY_FAILED]'
      const { outcome } = parseQuantifyResponse(content, 5)
      expect(outcome.type).toBe('failed')
    })

    it('strips [QUANTIFY_FAILED] from cleanContent', () => {
      const content = '說明\n[QUANTIFY_FAILED]'
      const { cleanContent } = parseQuantifyResponse(content, 5)
      expect(cleanContent).not.toContain('[QUANTIFY_FAILED]')
      expect(cleanContent).toContain('說明')
    })
  })

  describe('round 5 - malformed / missing terminal token', () => {
    it('returns continue for malformed QUANTIFY_RESULT JSON', () => {
      const content = '回答\n[QUANTIFY_RESULT]: {invalid json here}'
      const { outcome } = parseQuantifyResponse(content, 5)
      expect(outcome.type).toBe('continue')
    })

    it('returns continue when no terminal token at all on round 5', () => {
      const content = '繼續回答中，還沒得到結論'
      const { outcome } = parseQuantifyResponse(content, 5)
      expect(outcome.type).toBe('continue')
    })

    it('returns full content in cleanContent when no terminal token', () => {
      const content = '普通回答'
      const { cleanContent } = parseQuantifyResponse(content, 5)
      expect(cleanContent).toBe('普通回答')
    })
  })
})

describe('parseQuantifyResponse - cleanContent invariants', () => {
  it('trims whitespace from cleanContent', () => {
    const { cleanContent } = parseQuantifyResponse('  有內容  \n', 1)
    expect(cleanContent).toBe('有內容')
  })
})

describe('buildQuantifyAdvisorPrompt — bounded examples', () => {
  it('prompt contains Round 1 open format rule', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 1)
    expect(prompt).toContain('Round 1')
    expect(prompt).toContain('直接引用')
  })

  it('prompt requires examples in every round', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 2)
    expect(prompt).toContain('範例')
  })

  it('prompt forbids open-ended questions', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 1)
    expect(prompt).toContain('禁止')
  })
})
