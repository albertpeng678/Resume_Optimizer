import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonaCard } from '@/components/persona/PersonaCard'

describe('PersonaCard', () => {
  const props = {
    career: 'product-manager',
    title: '產品經理',
    description: '定義產品需求並撰寫規格文件、協調跨部門資源推動產品開發與上線',
    reason: '你的經歷與產品規劃高度相關',
    selected: false,
    onSelect: vi.fn(),
  }

  it('renders title and reason', () => {
    render(<PersonaCard {...props} />)
    expect(screen.getByText('產品經理')).toBeDefined()
    expect(screen.getByText('你的經歷與產品規劃高度相關')).toBeDefined()
  })

  it('shows AI badge when reason is provided', () => {
    render(<PersonaCard {...props} />)
    expect(screen.getByText('AI 推薦')).toBeDefined()
  })

  it('hides AI badge and reason when reason is not provided', () => {
    render(<PersonaCard {...props} reason={undefined} />)
    expect(screen.getByText('產品經理')).toBeDefined()
    expect(screen.queryByText('AI 推薦')).toBeNull()
  })

  it('renders tooltip with description', () => {
    render(<PersonaCard {...props} />)
    expect(screen.getByText(props.description)).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    render(<PersonaCard {...props} />)
    fireEvent.click(screen.getByText('產品經理'))
    expect(props.onSelect).toHaveBeenCalled()
  })

  it('shows check icon when selected', () => {
    render(<PersonaCard {...props} selected={true} />)
    expect(screen.getByTestId('check-icon')).toBeDefined()
  })
})
