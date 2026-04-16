'use client'
import { useState, useCallback, useEffect } from 'react'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'

interface FileUploadProps {
  onUploadComplete: (markdown: string) => void
}

const LOADING_STAGES = [
  '正在讀取文件...',
  'AI 審核履歷內容中...',
]

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // Cycle through loading stage messages
  useEffect(() => {
    if (!isLoading) { setLoadingStage(0); return }
    const timer = setTimeout(() => setLoadingStage(1), 1500)
    return () => clearTimeout(timer)
  }, [isLoading])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setIsLoading(true)
    setFileName(file.name)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onUploadComplete(data.markdown)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed'
      setError(message)
      setFileName(null)
    } finally {
      setIsLoading(false)
    }
  }, [onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleClick = () => {
    if (!isLoading) document.getElementById('file-input')?.click()
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-secondary/20 shadow-sm p-10 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <p className="font-semibold text-ink text-base mb-1">{LOADING_STAGES[loadingStage]}</p>
        <p className="text-sm text-ink/40 mb-6 truncate max-w-xs mx-auto">{fileName}</p>
        {/* Stage indicators */}
        <div className="flex items-center justify-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 ${loadingStage >= 0 ? 'text-primary font-medium' : 'text-ink/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${loadingStage === 0 ? 'bg-primary animate-bounce' : 'bg-cta'}`} />
            讀取文件
          </span>
          <span className="text-ink/20">→</span>
          <span className={`flex items-center gap-1.5 ${loadingStage >= 1 ? 'text-primary font-medium' : 'text-ink/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${loadingStage === 1 ? 'bg-primary animate-bounce' : 'bg-ink/20'}`} />
            AI 審核
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        onClick={handleClick}
        className="bg-white rounded-2xl border border-red-200 shadow-sm p-10 text-center cursor-pointer hover:border-red-300 transition-colors"
      >
        <input id="file-input" type="file" accept=".pdf,.docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="font-semibold text-ink text-base mb-2">上傳失敗</p>
        <p className="text-sm text-red-600 mb-4 leading-relaxed">{error}</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-full">
          <UploadCloud className="w-3.5 h-3.5" /> 點擊重新上傳
        </span>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        bg-white rounded-2xl border shadow-sm p-10 text-center cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-primary bg-primary/5 shadow-md scale-[1.01]'
          : 'border-secondary/30 hover:border-primary/60 hover:shadow-md'
        }
      `}
    >
      <input id="file-input" type="file" accept=".pdf,.docx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors
        ${isDragging ? 'bg-primary/20' : 'bg-primary/10'}`}>
        <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? 'text-primary' : 'text-primary/70'}`} />
      </div>

      <p className="font-semibold text-ink text-base mb-1">
        {isDragging ? '放開以上傳' : '拖曳或點擊上傳履歷'}
      </p>
      <p className="text-sm text-ink/40 mb-6">支援 PDF 和 DOCX 格式</p>

      <div className="flex items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1 bg-surface rounded-full text-xs text-ink/50 font-medium">
          <FileText className="w-3 h-3" /> PDF
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1 bg-surface rounded-full text-xs text-ink/50 font-medium">
          <FileText className="w-3 h-3" /> DOCX
        </span>
      </div>
    </div>
  )
}
