import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '@/components/chat/MessageBubble'

describe('MessageBubble', () => {
  it('renders user message as plain text', () => {
    render(<MessageBubble role="user" content="Hello **bold**" />)
    expect(screen.getByText('Hello **bold**')).toBeDefined()
  })

  it('renders assistant message with markdown bold', () => {
    render(<MessageBubble role="assistant" content="Hello **bold** world" />)
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders assistant message with markdown list', () => {
    render(<MessageBubble role="assistant" content={"- item one\n- item two"} />)
    expect(screen.getByText('item one')).toBeDefined()
    expect(screen.getByText('item two')).toBeDefined()
  })

  it('shows streaming cursor when isStreaming is true', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="typing" isStreaming={true} />
    )
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})
