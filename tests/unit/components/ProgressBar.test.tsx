import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@/components/wizard/ProgressBar'

describe('ProgressBar', () => {
  it('renders 3 step labels', () => {
    render(<ProgressBar currentStep={1} />)
    expect(screen.getByText('上傳履歷')).toBeDefined()
    expect(screen.getByText('選擇職位')).toBeDefined()
    expect(screen.getByText('選擇年資')).toBeDefined()
  })

  it('marks completed steps with checkmark', () => {
    render(<ProgressBar currentStep={3} />)
    const checkmarks = screen.getAllByText('✓')
    expect(checkmarks).toHaveLength(2)
  })
})
