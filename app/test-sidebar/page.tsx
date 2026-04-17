'use client'

import { useState } from 'react'
import { QuantifySidebar } from '@/components/chat/QuantifySidebar'
import { QuantifyTrigger } from '@/lib/agents/career-advisor'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'
import { Info } from 'lucide-react'

const MOCK_TRIGGER_TIME: QuantifyTrigger = {
  topic: 'RAG 系統效能優化',
  context: '將 RAG 知識問答查詢時間大幅縮短',
  original_text: '查詢時間縮短很多',
  formula_hint: 'time_reduction',
}

const MOCK_TRIGGER_SCALE: QuantifyTrigger = {
  topic: '用戶服務擴展',
  context: '推動平台功能改進，大幅增加活躍用戶數量',
  original_text: '幫助很多用戶解決了問題',
  formula_hint: 'scale_impact',
}

const MOCK_TRIGGER_SAFETY_NET: QuantifyTrigger = {
  topic: '跨部門專案協作',
  context: '帶領工程、產品、設計三個部門協作，推動關鍵功能如期上線',
  original_text: '負責協調跨部門團隊，確保專案如期交付',
  formula_hint: 'safety_net',
}

const SCENARIOS = [
  {
    key: 'time',
    trigger: MOCK_TRIGGER_TIME,
    label: '時間縮短（time_reduction）',
    description: '測試 AI 偵測到「查詢時間縮短」後，推薦時間計算公式的流程',
    color: 'bg-primary',
  },
  {
    key: 'scale',
    trigger: MOCK_TRIGGER_SCALE,
    label: '規模影響（scale_impact）',
    description: '測試 AI 偵測到「幫助很多用戶」後，推薦人數計算公式的流程',
    color: 'bg-secondary',
  },
  {
    key: 'safety_net',
    trigger: MOCK_TRIGGER_SAFETY_NET,
    label: '安全網模式（safety_net）',
    description: '測試無法明確量化時，顯示通用場景選項讓用戶自選的流程',
    color: 'bg-ink',
  },
]

export default function TestSidebarPage() {
  const [trigger, setTrigger] = useState<QuantifyTrigger | null>(null)
  const [lastResult, setLastResult] = useState<string>('')
  const [activeKey, setActiveKey] = useState<string>('')

  function handleComplete(entry: QuantifyEntry | null) {
    if (entry) {
      setLastResult(`已儲存：${entry.result?.background ?? '(無預覽)'}`)
    } else {
      setLastResult('用戶選擇略過量化')
    }
    setTrigger(null)
    setActiveKey('')
  }

  function handleDismiss() {
    setLastResult('用戶關閉了側邊欄')
    setTrigger(null)
    setActiveKey('')
  }

  function activateScenario(scenario: typeof SCENARIOS[number]) {
    setTrigger(scenario.trigger)
    setActiveKey(scenario.key)
    setLastResult('')
  }

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold text-ink">QuantifySidebar 測試頁</h1>
          <p className="text-sm text-ink/50 mt-1">
            模擬 AI 訪談中偵測到可量化成就時，底部側邊欄彈出的完整互動流程
          </p>
        </div>

        {/* How to test */}
        <div className="bg-white border border-secondary/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide">測試說明</p>
          </div>
          <ol className="text-sm text-ink/70 space-y-1 list-decimal list-inside">
            <li>點擊下方任一情境按鈕，底部側邊欄會滑出</li>
            <li>選擇一個最符合的情境卡片</li>
            <li>填入數字，預覽結果會即時顯示</li>
            <li>點「儲存這個數字」完成，或「沒辦法量化」略過</li>
          </ol>
        </div>

        {/* Scenario buttons */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">選擇測試情境</p>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => activateScenario(s)}
              className={`
                w-full text-left px-4 py-3 rounded-xl border transition-colors
                ${
                  activeKey === s.key
                    ? 'border-primary bg-primary/5'
                    : 'border-secondary/20 bg-white hover:border-secondary/50'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${s.color}`}
                />
                <span className="text-sm font-medium text-ink">{s.label}</span>
              </div>
              <p className="text-xs text-ink/50 pl-4">{s.description}</p>
            </button>
          ))}

          {trigger && (
            <button
              onClick={() => { setTrigger(null); setActiveKey(''); setLastResult(''); }}
              className="w-full px-4 py-2.5 border border-secondary/20 text-ink/50 rounded-xl text-sm
                         hover:text-ink hover:border-secondary/40 transition-colors text-center"
            >
              隱藏側邊欄
            </button>
          )}
        </div>

        {/* Last action result */}
        {lastResult && (
          <div className="bg-white border border-secondary/20 rounded-xl p-4">
            <p className="text-xs text-ink/40 mb-1">上次操作結果</p>
            <p className="text-sm text-ink font-medium">{lastResult}</p>
          </div>
        )}

        {/* Current trigger debug panel */}
        <div className="bg-white border border-secondary/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">目前 Trigger（除錯用）</p>
          <pre className="text-xs text-ink/60 overflow-x-auto whitespace-pre-wrap">
            {trigger ? JSON.stringify(trigger, null, 2) : 'null（側邊欄隱藏中）'}
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
