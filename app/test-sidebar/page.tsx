'use client'

import { useState } from 'react'
import { QuantifySidebar } from '@/components/chat/QuantifySidebar'
import { QuantifyTrigger } from '@/lib/agents/career-advisor'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

const MOCK_TRIGGER_NORMAL: QuantifyTrigger = {
  topic: '自動化流程優化',
  context: '用戶描述他們將部署流程從手動改為自動化，節省了大量時間',
  original_text: '主導了 CI/CD 自動化改造，大幅縮短了部署時間',
  formula_hint: 'time_reduction',
}

const MOCK_TRIGGER_SAFETY_NET: QuantifyTrigger = {
  topic: '團隊領導',
  context: '用戶描述他們帶領團隊完成了重要項目',
  original_text: '負責帶領跨部門團隊，確保項目如期交付',
  formula_hint: 'safety_net',
}

export default function TestSidebarPage() {
  const [trigger, setTrigger] = useState<QuantifyTrigger | null>(null)
  const [lastResult, setLastResult] = useState<string>('')

  function handleComplete(entry: QuantifyEntry | null) {
    if (entry) {
      setLastResult(`已儲存：${entry.result?.background ?? '(無預覽)'}`)
    } else {
      setLastResult('用戶略過了量化')
    }
    setTrigger(null)
  }

  function handleDismiss() {
    setLastResult('用戶關閉了側邊欄')
    setTrigger(null)
  }

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">QuantifySidebar 測試頁</h1>
          <p className="text-sm text-ink/50 mt-1">
            點擊下方按鈕觸發不同模式的側邊欄
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setTrigger(MOCK_TRIGGER_NORMAL)}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium
                       hover:bg-primary/90 transition-colors"
          >
            觸發一般模式（time_reduction）
          </button>

          <button
            onClick={() => setTrigger(MOCK_TRIGGER_SAFETY_NET)}
            className="px-4 py-2 bg-secondary text-white rounded-xl text-sm font-medium
                       hover:bg-secondary/90 transition-colors"
          >
            觸發安全網模式（safety_net）
          </button>

          {trigger && (
            <button
              onClick={() => setTrigger(null)}
              className="px-4 py-2 border border-secondary/30 text-ink/60 rounded-xl text-sm
                         hover:text-ink hover:border-secondary/60 transition-colors"
            >
              隱藏側邊欄
            </button>
          )}
        </div>

        {lastResult && (
          <div className="bg-white border border-secondary/20 rounded-xl p-4">
            <p className="text-xs text-ink/50 mb-1">上次操作結果</p>
            <p className="text-sm text-ink font-medium">{lastResult}</p>
          </div>
        )}

        <div className="bg-white border border-secondary/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">目前 Trigger</p>
          <pre className="text-xs text-ink/70 overflow-x-auto whitespace-pre-wrap">
            {trigger ? JSON.stringify(trigger, null, 2) : 'null'}
          </pre>
        </div>

        {/* Spacer so the panel doesn't cover content */}
        <div className="h-64" />
      </div>

      <QuantifySidebar
        trigger={trigger}
        sessionId="test-session-id"
        onComplete={handleComplete}
        onDismiss={handleDismiss}
      />
    </div>
  )
}
