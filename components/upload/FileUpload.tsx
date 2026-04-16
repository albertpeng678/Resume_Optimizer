'use client'
import { useState, useCallback } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'

interface FileUploadProps {
  onUploadComplete: (markdown: string) => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

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

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging ? 'border-primary bg-primary/5' : 'border-secondary/40 hover:border-primary'}
      `}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 text-primary">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-medium">正在解析 {fileName}...</p>
        </div>
      ) : fileName && !error ? (
        <div className="flex flex-col items-center gap-3 text-primary">
          <FileText className="w-10 h-10" />
          <p className="font-medium">{fileName} 解析完成</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-ink/60">
          <Upload className="w-10 h-10" />
          <p className="text-lg font-medium text-ink">上傳你的履歷</p>
          <p className="text-sm">PDF 或 DOCX，拖曳或點擊上傳</p>
        </div>
      )}
      {error && (
        <p className="mt-3 text-red-500 text-sm">{error}</p>
      )}
    </div>
  )
}
