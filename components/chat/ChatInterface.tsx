'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, FileText, Loader2, PlusCircle, ArrowDown } from 'lucide-react'
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
  interviewGaps: string[]
}

export function ChatInterface({
  sessionId,
  personaTitle,
  gapsTotal,
  gapsCompleted: initialGapsCompleted,
  initialHistory,
  quantifyData: initialQuantifyData,
  interviewGaps,
}: ChatInterfaceProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  )
  const [streamingContent, setStreamingContent] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [gapsCompleted, setGapsCompleted] = useState(initialGapsCompleted)
  const [quantifyData, setQuantifyData] = useState<QuantifyEntry[]>(initialQuantifyData)
  const [quantifyTrigger, setQuantifyTrigger] = useState<QuantifyTrigger | null>(null)
  const [showQuantifyModal, setShowQuantifyModal] = useState(false)
  const [manualQuantifyOpen, setManualQuantifyOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isComplete = gapsCompleted >= gapsTotal && gapsTotal > 0
  const currentTopicName = gapsCompleted < interviewGaps.length
    ? interviewGaps[gapsCompleted]
    : undefined

  function isNearBottom(): boolean {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollButton(false)
  }

  function handleScroll() {
    setShowScrollButton(!isNearBottom())
  }

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom()
    } else if (isStreaming) {
      setShowScrollButton(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingContent, messages])

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`)
      if (!res.ok) return
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
    setQuantifyTrigger(null)
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')

    let finalContent = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage }),
      })

      if (!response.ok || !response.body) throw new Error('Chat request failed')

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
          if (dataLine === undefined) continue

          if (eventType === 'text') {
            const chunk: string = JSON.parse(dataLine)
            setStreamingContent((prev) => prev + chunk)
          } else if (eventType === 'replace') {
            finalContent = JSON.parse(dataLine)
            setStreamingContent(finalContent)
          } else if (eventType === 'trigger') {
            const trigger: QuantifyTrigger = JSON.parse(dataLine)
            setQuantifyTrigger(trigger)
          } else if (eventType === 'done') {
            setMessages((prev) => [...prev, { role: 'assistant', content: finalContent }])
            setStreamingContent('')
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，發生了錯誤，請再試一次。' },
      ])
      setStreamingContent('')
    } finally {
      setIsStreaming(false)
      await syncSession()
      inputRef.current?.focus()
    }
  }

  function handleQuantifyComplete(entry: QuantifyEntry | null) {
    if (entry) setQuantifyData((prev) => [...prev, entry])
    setShowQuantifyModal(false)
    setQuantifyTrigger(null)
    inputRef.current?.focus()
  }

  function handleManualQuantifyComplete(entry: QuantifyEntry | null) {
    if (entry) setQuantifyData((prev) => [...prev, entry])
    setManualQuantifyOpen(false)
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
    <div className="flex flex-col flex-1 min-h-0 bg-surface relative">
      {/* Header */}
      <div className="bg-white border-b border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <InterviewProgress
            gapsCompleted={gapsCompleted}
            gapsTotal={gapsTotal}
            personaTitle={personaTitle}
            interviewGaps={interviewGaps}
          />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-12">
              <p className="text-ink/40 text-sm">職涯顧問已準備好，請開始對話</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} isStreaming={true} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-36 right-6 bg-white shadow-lg border border-secondary/20
                     rounded-full px-3 py-2 text-xs text-ink/70 hover:text-ink flex items-center gap-1
                     transition-colors z-10"
        >
          <ArrowDown className="w-3 h-3" />
          新訊息
        </button>
      )}

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
                <><Loader2 className="w-4 h-4 animate-spin" />正在生成優化履歷...</>
              ) : (
                <><FileText className="w-4 h-4" />生成優化履歷</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <button
            onClick={() => setManualQuantifyOpen(true)}
            disabled={isStreaming}
            title="手動觸發量化訪談"
            className="flex items-center gap-1 px-2 py-2 text-secondary hover:text-primary
                       transition-colors disabled:opacity-40 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">量化數字</span>
          </button>
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

      {/* Auto-triggered Quantify Modal */}
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

      {/* Manually-triggered Quantify Modal */}
      <QuantifyModal
        isOpen={manualQuantifyOpen}
        topic={currentTopicName || '工作成就'}
        context={`使用者手動觸發量化訪談，請詢問他想量化哪個成就（主題：${currentTopicName || '工作成就'}）`}
        sessionId={sessionId}
        onComplete={handleManualQuantifyComplete}
        onClose={() => setManualQuantifyOpen(false)}
      />
    </div>
  )
}
