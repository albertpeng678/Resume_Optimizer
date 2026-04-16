import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LevelCard } from '@/components/persona/LevelCard'

describe('LevelCard', () => {
  const props = {
    level: 'mid' as const,
    label: 'Mid-level',
    years: '3-5 年',
    selected: false,
    onSelect: vi.fn(),
  }

  it('renders label and years', () => {
    render(<LevelCard {...props} />)
    expect(screen.getByText('Mid-level')).toBeDefined()
    expect(screen.getByText('3-5 年')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    render(<LevelCard {...props} />)
    fireEvent.click(screen.getByText('Mid-level'))
    expect(props.onSelect).toHaveBeenCalled()
  })

  it('applies selected style', () => {
    const { container } = render(<LevelCard {...props} selected={true} />)
    expect(container.firstElementChild?.className).toContain('border-primary')
  })
})
