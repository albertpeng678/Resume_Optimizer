'use client'

import { useState, type ReactNode } from 'react'
import { Download, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

interface ResumePreviewProps {
  sessionId: string
  resumeText: string   // may contain [Q:id]number[/Q] tags
  quantifyData: QuantifyEntry[]
}

interface QuantifyBadgeProps {
  number: string
  entry: QuantifyEntry | undefined
}

function QuantifyBadge({ number, entry }: QuantifyBadgeProps) {
  return (
    <span className="group relative inline-block">
      <span className="bg-cta/10 text-cta border border-cta/30 rounded px-1 text-sm font-medium cursor-help">
        {number}
      </span>
      {entry?.result && (
        <span
          className="absolute bottom-full left-0 mb-1 w-64 p-2.5 bg-ink text-white text-xs rounded-lg
                     opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none
                     leading-relaxed shadow-lg"
        >
          <span className="font-medium block mb-1">數字來源</span>
          {entry.result.background}
        </span>
      )}
    </span>
  )
}

// Parse inline content, replacing [Q:id]number[/Q] with QuantifyBadge components
function parseInlineContent(
  text: string,
  quantifyMap: Map<string, QuantifyEntry>
): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\[Q:([^\]]+)\](.*?)\[\/Q\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const [, id, number] = match
    const entry = quantifyMap.get(id)
    parts.push(<QuantifyBadge key={`q-${id}-${match.index}`} number={number} entry={entry} />)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

interface RenderedLine {
  type: 'h2' | 'bullet1' | 'bullet2' | 'blank' | 'text'
  content: string
}

function parseLines(text: string): RenderedLine[] {
  return text.split('\n').map((line): RenderedLine => {
    if (line.startsWith('## ')) return { type: 'h2', content: line.slice(3) }
    if (line.startsWith('  - ')) return { type: 'bullet2', content: line.slice(4) }
    if (line.startsWith('- ')) return { type: 'bullet1', content: line.slice(2) }
    if (line.trim() === '') return { type: 'blank', content: '' }
    return { type: 'text', content: line }
  })
}

export function ResumePreview({ sessionId, resumeText, quantifyData }: ResumePreviewProps) {
  const [showSources, setShowSources] = useState(false)

  const quantifyMap = new Map<string, QuantifyEntry>(quantifyData.map((e) => [e.id, e]))
  const successfulQuantify = quantifyData.filter((e) => e.result !== null)

  const lines = parseLines(resumeText)

  return (
    <div className="flex-1 min-h-0 bg-surface overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-secondary/20 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-ink">優化後的履歷</h1>
          <a
            href={`/api/download/${sessionId}`}
            download
            className="flex items-center gap-1.5 px-4 py-2 bg-cta text-white rounded-xl text-sm font-medium
                       hover:bg-cta/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            下載 Word 檔
          </a>
        </div>
      </div>

      {/* Resume content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* A4 preview card */}
        <div className="bg-white rounded-2xl shadow-sm border border-secondary/20 p-8 mb-6">
          {lines.map((line, i) => {
            if (line.type === 'h2') {
              return (
                <h2 key={i} className="text-primary font-bold text-base mt-6 mb-2 first:mt-0 border-b border-secondary/20 pb-1">
                  {line.content}
                </h2>
              )
            }
            if (line.type === 'bullet1') {
              return (
                <li key={i} className="ml-4 text-sm text-ink leading-relaxed list-disc marker:text-secondary">
                  {parseInlineContent(line.content, quantifyMap)}
                </li>
              )
            }
            if (line.type === 'bullet2') {
              return (
                <li key={i} className="ml-8 text-sm text-ink/70 leading-relaxed list-[circle] marker:text-secondary/50">
                  {parseInlineContent(line.content, quantifyMap)}
                </li>
              )
            }
            if (line.type === 'blank') {
              return <div key={i} className="h-2" />
            }
            return (
              <p key={i} className="text-sm text-ink leading-relaxed">
                {parseInlineContent(line.content, quantifyMap)}
              </p>
            )
          })}
        </div>

        {/* Quantify number sources */}
        {successfulQuantify.length > 0 && (
          <div className="bg-white rounded-2xl border border-secondary/20 overflow-hidden mb-6">
            <button
              onClick={() => setShowSources(!showSources)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cta" />
                <span className="text-sm font-medium text-ink">
                  量化數字來源說明（{successfulQuantify.length} 個）
                </span>
              </div>
              {showSources ? (
                <ChevronUp className="w-4 h-4 text-ink/40" />
              ) : (
                <ChevronDown className="w-4 h-4 text-ink/40" />
              )}
            </button>

            {showSources && (
              <div className="border-t border-secondary/20 divide-y divide-secondary/10">
                {successfulQuantify.map((entry) => (
                  <div key={entry.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 bg-cta/10 text-cta border border-cta/30 rounded px-1.5 text-xs font-medium shrink-0">
                        {entry.result!.number}{entry.result!.metric}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-ink mb-0.5">{entry.topic}</p>
                        <p className="text-xs text-ink/60 leading-relaxed">{entry.result!.background}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-surface border border-secondary/20 rounded-xl px-4 py-3">
          <p className="text-xs text-ink/50 leading-relaxed">
            履歷已針對目標職位優化，限制在 2 頁 A4 以內。
            {successfulQuantify.length > 0 && (
              <> 帶有綠色標籤的數字可以懸停查看來源說明。</>
            )}
            下載 Word 檔後可直接投遞或進一步編輯。
          </p>
        </div>
      </div>
    </div>
  )
}
