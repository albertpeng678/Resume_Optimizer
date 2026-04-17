import { describe, it, expect } from 'vitest'
import {
  buildCareerAdvisorPrompt,
  parseQuantifyTrigger,
  stripQuantifyTrigger,
  parseGapStatus,
  stripGapStatus,
} from '@/lib/agents/career-advisor'

describe('parseQuantifyTrigger', () => {
  it('parses valid [QUANTIFY_TRIGGER] line with new fields', () => {
    const content =
      '很好的分享。\n[QUANTIFY_TRIGGER]: {"topic": "revenue_impact", "context": "用戶描述帶來業績成長", "original_text": "主導 RAG 知識問答產品", "formula_hint": "percentage_improvement"}\n[GAPS_STATUS]: {"completed":[],"skipped":[],"current":"revenue_impact","current_turns":1}'
    const result = parseQuantifyTrigger(content)
    expect(result).not.toBeNull()
    expect(result!.topic).toBe('revenue_impact')
    expect(result!.context).toBe('用戶描述帶來業績成長')
    expect(result!.original_text).toBe('主導 RAG 知識問答產品')
    expect(result!.formula_hint).toBe('percentage_improvement')
  })

  it('returns null when no [QUANTIFY_TRIGGER] present', () => {
    const content =
      '正常回答\n[GAPS_STATUS]: {"completed":[],"skipped":[],"current":"quantified_outcomes","current_turns":0}'
    expect(parseQuantifyTrigger(content)).toBeNull()
  })

  it('returns null for malformed JSON in trigger', () => {
    const content = '[QUANTIFY_TRIGGER]: {broken json'
    expect(parseQuantifyTrigger(content)).toBeNull()
  })
})

describe('stripQuantifyTrigger', () => {
  it('removes [QUANTIFY_TRIGGER] line from content', () => {
    const content =
      '回答內容\n[QUANTIFY_TRIGGER]: {"topic":"t","context":"c","original_text":"原文","formula_hint":"scale_impact"}\n[GAPS_STATUS]: {"completed":[],"skipped":[],"current":"t","current_turns":1}'
    const stripped = stripQuantifyTrigger(content)
    expect(stripped).not.toContain('[QUANTIFY_TRIGGER]')
    expect(stripped).toContain('回答內容')
    expect(stripped).toContain('[GAPS_STATUS]')
  })

  it('returns content unchanged when no trigger present', () => {
    const content =
      '普通回答\n[GAPS_STATUS]: {"completed":[],"skipped":[],"current":"gap1","current_turns":0}'
    expect(stripQuantifyTrigger(content)).toBe(content)
  })
})

describe('parseGapStatus', () => {
  it('parses valid [GAPS_STATUS] with all new fields', () => {
    const content =
      '回答\n[GAPS_STATUS]: {"completed":["gap1","gap2"],"skipped":["gap0"],"current":"gap3","current_turns":2}'
    const result = parseGapStatus(content)
    expect(result).not.toBeNull()
    expect(result!.completed).toEqual(['gap1', 'gap2'])
    expect(result!.skipped).toEqual(['gap0'])
    expect(result!.current).toBe('gap3')
    expect(result!.current_turns).toBe(2)
  })

  it('is backward-compatible: defaults new fields when absent', () => {
    const content =
      '回答\n[GAPS_STATUS]: {"completed":["gap1","gap2"],"current":"gap3"}'
    const result = parseGapStatus(content)
    expect(result).not.toBeNull()
    expect(result!.completed).toEqual(['gap1', 'gap2'])
    expect(result!.skipped).toEqual([])
    expect(result!.current).toBe('gap3')
    expect(result!.current_turns).toBe(0)
  })

  it('returns null when no [GAPS_STATUS] present', () => {
    expect(parseGapStatus('普通回答')).toBeNull()
  })
})

describe('stripGapStatus', () => {
  it('removes [GAPS_STATUS] line from content', () => {
    const content =
      '回答\n[GAPS_STATUS]: {"completed":[],"skipped":[],"current":"g","current_turns":0}'
    const stripped = stripGapStatus(content)
    expect(stripped).not.toContain('[GAPS_STATUS]')
    expect(stripped).toContain('回答')
  })
})

describe('buildCareerAdvisorPrompt — structured opening', () => {
  const mockPersona = {
    id: 'pm-mid',
    title: '產品經理',
    years: '3-5年',
    core_skills: ['產品規劃', '數據分析'],
    keywords: ['roadmap', 'OKR'],
    responsibilities: ['定義產品需求'],
    interview_gaps: ['跨部門協作經驗', '數據驅動決策', '專案交付成果'],
  }
  const mockResume = '我曾主導 RAG 知識問答系統從 0 到 1 建置，並定義關鍵量化指標。'

  it('prompt contains N-topic announcement with exact count', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('3 個主題')
  })

  it('prompt lists all interview_gaps by name', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('跨部門協作經驗')
    expect(prompt).toContain('數據驅動決策')
    expect(prompt).toContain('專案交付成果')
  })

  it('prompt instructs AI to open with topic list', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('第一則訊息')
  })

  it('QUANTIFY_TRIGGER rule uses aggressive language not cautious', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).not.toContain('不要每次都加')
    expect(prompt).toContain('必須')
  })

  it('prompt includes MCQ instruction', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('選擇題')
    expect(prompt).toContain('A.')
  })

  it('prompt includes 3-turn exit mechanism', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('3 輪退出機制')
    expect(prompt).toContain('skipped')
  })

  it('prompt forbids placeholder tokens', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('嚴禁佔位符')
  })

  it('QUANTIFY_TRIGGER format includes original_text and formula_hint', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('original_text')
    expect(prompt).toContain('formula_hint')
  })

  it('GAPS_STATUS format includes skipped and current_turns', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('"skipped"')
    expect(prompt).toContain('current_turns')
  })
})
