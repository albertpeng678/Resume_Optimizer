'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { QuantifyEntry, QuantifyResult } from '@/lib/agents/quantify-advisor'

interface QuantifyModalProps {
  isOpen: boolean
  topic: string
  context: string
  sessionId: string
  onComplete: (entry: QuantifyEntry | null) => void
  onClose: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function QuantifyModal({
  isOpen,
  topic,
  context,
  sessionId,
  onComplete,
  onClose,
}: QuantifyModalProps) {
  const [round, setRound] = useState(1)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [result, setResult] = useState<QuantifyResult | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Reset and auto-start when modal opens
  useEffect(() => {
    if (!isOpen) return
    setRound(1)
    setMessages([])
    setInputValue('')
    setIsLoading(false)
    setEntryId(null)
    setResult(null)
    setIsComplete(false)
    // Auto-fetch AI opener using context as the seed message
    fetchAutoStart()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function fetchAutoStart() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/quantify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic,
          context,
          messages: [],
          roundNumber: 1,
          userMessage: context || topic,
        }),
      })
      if (!res.ok) throw new Error('auto-start failed')
      const data = await res.json()
      setMessages([{ role: 'assistant', content: data.assistantMessage }])
      setEntryId(data.entryId)
      setRound(2)
    } catch {
      setMessages([{ role: 'assistant', content: `你提到了「${context || topic}」，請告訴我更多細節，我來幫你找出具體數字。` }])
      setRound(1)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  async function sendMessage() {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/quantify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic,
          context,
          messages,
          roundNumber: round,
          userMessage,
          entryId: entryId ?? undefined,
        }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.assistantMessage }])

      if (!entryId) setEntryId(data.entryId)

      if (data.isComplete) {
        setIsComplete(true)
        setResult(data.result)
      } else {
        setRound((r) => r + 1)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，發生了錯誤，請稍後再試。' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleConfirmResult() {
    if (!entryId) {
      onComplete(null)
      return
    }
    const entry: QuantifyEntry = {
      id: entryId,
      topic,
      context,
      result,
      rounds: messages,
      completedAt: new Date().toISOString(),
    }
    onComplete(entry)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={() => !isLoading && onClose()}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary/20">
          <div>
            <h2 className="font-semibold text-ink">量化訪談助手</h2>
            <p className="text-xs text-ink/50 mt-0.5 line-clamp-1">{context}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink/40 hover:text-ink/70 hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Round progress */}
        <div className="px-5 py-3 border-b border-secondary/10 flex items-center gap-2">
          <span className="text-xs text-ink/50">第 {Math.min(round, 5)}/5 輪</span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < round - 1
                    ? 'bg-primary'
                    : i === round - 1
                    ? 'bg-secondary'
                    : 'bg-secondary/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-4">
              告訴我你的成就，我來幫你找出具體數字
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`px-3 py-2 rounded-xl max-w-[85%] text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-surface text-ink border border-secondary/20 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl bg-surface border border-secondary/20 rounded-bl-sm">
                <Loader2 className="w-4 h-4 text-secondary animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Result state */}
        {isComplete && (
          <div className="px-5 pb-4">
            {result ? (
              <div className="bg-cta/10 border border-cta/30 rounded-xl p-4 mb-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-cta mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      找到量化數字：{result.number}{result.metric}
                    </p>
                    <p className="text-xs text-ink/60 mt-1">{result.background}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-secondary/20 rounded-xl p-4 mb-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-ink/40 mt-0.5 shrink-0" />
                  <p className="text-sm text-ink/50">
                    無法找到具體數字，此欄位將不會加入量化數字，不影響履歷品質。
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={handleConfirmResult}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {result ? '使用此數字' : '確認略過'}
            </button>
          </div>
        )}

        {/* Input area */}
        {!isComplete && (
          <div className="px-5 pb-4 pt-2 border-t border-secondary/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="回答問題..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-secondary/30 rounded-xl
                           focus:outline-none focus:border-primary text-ink placeholder:text-ink/30
                           disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium
                           hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                送出
              </button>
            </div>
            <button
              onClick={() => onComplete(null)}
              className="mt-2 w-full text-xs text-ink/40 hover:text-ink/60 transition-colors py-1"
            >
              跳過量化訪談
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
