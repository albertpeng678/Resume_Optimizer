import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUpload } from '@/components/upload/FileUpload'

describe('FileUpload', () => {
  it('renders upload prompt', () => {
    render(<FileUpload onUploadComplete={vi.fn()} />)
    expect(screen.getByText('拖曳或點擊上傳履歷')).toBeDefined()
    expect(screen.getByText('支援 PDF 和 DOCX 格式')).toBeDefined()
  })

  it('shows loading state during upload', async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    render(<FileUpload onUploadComplete={vi.fn()} />)

    const input = document.getElementById('file-input') as HTMLInputElement
    const file = new File(['test'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText(/正在讀取/)).toBeDefined()
  })

  it('shows error on upload failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file' }),
      })
    ) as any

    const onComplete = vi.fn()
    render(<FileUpload onUploadComplete={onComplete} />)

    const input = document.getElementById('file-input') as HTMLInputElement
    const file = new File(['test'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid file')).toBeDefined()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByText('上傳失敗')).toBeDefined()
    expect(screen.getByText('點擊重新上傳')).toBeDefined()
  })
})
