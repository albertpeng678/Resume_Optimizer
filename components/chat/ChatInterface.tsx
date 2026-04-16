'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, FileText, Loader2 } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { InterviewProgress } from './InterviewProgress'
import { QuantifyModal } from './QuantifyModal'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface QuantifyTrigger {
  topic: string
  context: string
}

interface ChatInterfaceProps {
  sessionId: string
  personaTitle: string
  gapsTotal: number
  gapsCompleted: number
  initialHistory: Array<{ role: string; content: string }>
  quantifyData: QuantifyEntry[]
}

export function ChatInterface({
  sessionId,
  personaTitle,
  gapsTotal,
  gapsCompleted: initialGapsCompleted,
  initialHistory,
  quantifyData: initialQuantifyData,
}: ChatInterfaceProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  )
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [gapsCompleted, setGapsCompleted] = useState(initialGapsCompleted)
  const [quantifyData, setQuantifyData] = useState<QuantifyEntry[]>(initialQuantifyData)
  const [quantifyTrigger, setQuantifyTrigger] = useState<QuantifyTrigger | null>(null)
  const [showQuantifyModal, setShowQuantifyModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isComplete = gapsCompleted >= gapsTotal && gapsTotal > 0

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`)
      if (!res.ok) {
        console.warn('syncSession: unexpected status', res.status)
        return
      }
      const data = await res.json()
      setGapsCompleted(data.gaps_completed ?? 0)
      setQuantifyData(data.quantify_data ?? [])
    } catch (err) {
      console.warn('syncSession failed:', err)
    }
  }, [sessionId])

  async function sendMessage() {
    if (!inputValue.trim() || isStreaming) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setQuantifyTrigger(null) // Clear previous trigger

    // Optimistically append user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)

    // Append empty assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Chat request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const lines = event.trim().split('\n')
          const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
          const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(6)
          if (!dataLine) continue

          if (eventType === 'text') {
            const chunk: string = JSON.parse(dataLine)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + chunk }
              }
              return updated
            })
          } else if (eventType === 'trigger') {
            const trigger: QuantifyTrigger = JSON.parse(dataLine)
            setQuantifyTrigger(trigger)
          }
          // 'done' event: stream complete
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          updated[updated.length - 1] = { ...last, content: '抱歉，發生了錯誤，請再試一次。' }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      await syncSession()
      inputRef.current?.focus()
    }
  }

  function handleQuantifyComplete(entry: QuantifyEntry | null) {
    if (entry) {
      setQuantifyData((prev) => [...prev, entry])
    }
    setShowQuantifyModal(false)
    setQuantifyTrigger(null)
    inputRef.current?.focus()
  }

  async function generateResume() {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('Map failed')
      router.push(`/result/${sessionId}`)
    } catch (err) {
      console.error('Generate resume error:', err)
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <InterviewProgress
            gapsCompleted={gapsCompleted}
            gapsTotal={gapsTotal}
            personaTitle={personaTitle}
          />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-ink/40 text-sm">職涯顧問已準備好，請開始對話</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
        </div>
      </div>

      {/* Quantify trigger banner */}
      {quantifyTrigger && !isStreaming && !showQuantifyModal && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-800">需要幫你找出具體數字嗎？</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowQuantifyModal(true)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  開始量化訪談
                </button>
                <button
                  onClick={() => setQuantifyTrigger(null)}
                  className="px-3 py-1.5 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors"
                >
                  略過
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate resume CTA */}
      {isComplete && !isStreaming && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={generateResume}
              disabled={isGenerating}
              className="w-full py-3.5 bg-cta text-white rounded-xl font-semibold text-sm
                         hover:bg-cta/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成優化履歷...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  生成優化履歷
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={isComplete ? '訪談已完成，可繼續補充...' : '輸入你的回答...'}
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 border border-secondary/30 rounded-xl text-sm text-ink
                       placeholder:text-ink/30 focus:outline-none focus:border-primary
                       disabled:opacity-50 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !inputValue.trim()}
            className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90
                       transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quantify Modal */}
      {quantifyTrigger && (
        <QuantifyModal
          isOpen={showQuantifyModal}
          topic={quantifyTrigger.topic}
          context={quantifyTrigger.context}
          sessionId={sessionId}
          onComplete={handleQuantifyComplete}
          onClose={() => setShowQuantifyModal(false)}
        />
      )}
    </div>
  )
}
