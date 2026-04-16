import { describe, it, expect } from 'vitest'
import { getCareerList, getPersona } from '@/lib/persona/templates'

describe('getCareerList', () => {
  it('returns 18 unique career categories', () => {
    const careers = getCareerList()
    expect(careers).toHaveLength(18)
    const ids = careers.map(c => c.id)
    expect(new Set(ids).size).toBe(18)
  })

  it('each career has id, title, and description', () => {
    const careers = getCareerList()
    for (const career of careers) {
      expect(career.id).toBeTruthy()
      expect(career.title).toBeTruthy()
      expect(career.description).toBeTruthy()
      expect(career.id).not.toMatch(/-junior$|-mid$|-senior$/)
    }
  })

  it('title comes from mid template (no level prefix)', () => {
    const careers = getCareerList()
    const pm = careers.find(c => c.id === 'product-manager')
    expect(pm?.title).toBe('產品經理')
  })

  it('prefers mid template title for all careers', () => {
    const careers = getCareerList()
    for (const career of careers) {
      const midPersona = getPersona(`${career.id}-mid`)
      if (midPersona) {
        expect(career.title).toBe(midPersona.title)
      }
    }
  })

  it('career id can combine with level to find a valid persona', () => {
    const careers = getCareerList()
    for (const career of careers) {
      for (const level of ['junior', 'mid', 'senior']) {
        const persona = getPersona(`${career.id}-${level}`)
        expect(persona).not.toBeNull()
      }
    }
  })
})
