'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, X, Loader2 } from 'lucide-react'
import { FormulaTemplate, FormulaVariable, QuantifyEntry } from '@/lib/agents/quantify-advisor'
import { QuantifyTrigger } from '@/lib/agents/career-advisor'

interface QuantifySidebarProps {
  trigger: QuantifyTrigger | null
  sessionId: string
  onComplete: (entry: QuantifyEntry | null) => void
  onDismiss: () => void
}

const SAFETY_NET_FORMULAS: FormulaTemplate[] = [
  {
    id: 'percentage_improvement',
    label: '百分比提升',
    formula: 'improvement_percent',
    resultTemplate: '提升 {result}%',
    traceFormula: '直接輸入改善百分比',
    variables: [
      {
        key: 'improvement_percent',
        label: '改善幅度（%）',
        placeholder: '例如：30',
        estimated: '',
      },
    ],
  },
  {
    id: 'scale_impact',
    label: '規模影響',
    formula: 'count',
    resultTemplate: '影響 {result} 人',
    traceFormula: '直接輸入影響人數',
    variables: [
      {
        key: 'count',
        label: '影響人數',
        placeholder: '例如：500',
        estimated: '',
      },
    ],
  },
  {
    id: 'time_reduction',
    label: '時間縮短',
    formula: '((before - after) / before) * 100',
    resultTemplate: '縮短 {result}%',
    traceFormula: '(優化前 - 優化後) / 優化前 × 100%',
    variables: [
      {
        key: 'before',
        label: '優化前（任意單位）',
        placeholder: '例如：10',
        estimated: '',
      },
      {
        key: 'after',
        label: '優化後（任意單位）',
        placeholder: '例如：3',
        estimated: '',
      },
    ],
  },
]

function computeResult(formula: string, variables: Record<string, string>): number | null {
  try {
    const scope = Object.fromEntries(
      Object.entries(variables).map(([k, v]) => [k, parseFloat(v)])
    )
    if (Object.values(scope).some(isNaN)) return null
    let expr = formula
    for (const [k, v] of Object.entries(scope)) {
      expr = expr.replace(new RegExp(k, 'g'), String(v))
    }
    const result = Function(`'use strict'; return (${expr})`)()
    return typeof result === 'number' && isFinite(result)
      ? Math.round(result * 10) / 10
      : null
  } catch {
    return null
  }
}

function buildPreview(template: string, result: number): string {
  return template.replace('{result}', String(result))
}

export function QuantifySidebar({
  trigger,
  sessionId,
  onComplete,
  onDismiss,
}: QuantifySidebarProps) {
  const [formulas, setFormulas] = useState<FormulaTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('')
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSafetyNet = trigger?.formula_hint === 'safety_net'
  const isVisible = trigger !== null

  const selectedFormula = formulas.find((f) => f.id === selectedFormulaId) ?? null

  const computedResult =
    selectedFormula && Object.keys(variableValues).length > 0
      ? computeResult(selectedFormula.formula, variableValues)
      : null

  const previewText =
    computedResult !== null && selectedFormula
      ? buildPreview(selectedFormula.resultTemplate, computedResult)
      : null

  const fetchFormulas = useCallback(
    async (t: QuantifyTrigger) => {
      setIsLoading(true)
      setFormulas([])
      setSelectedFormulaId('')
      setVariableValues({})
      try {
        const res = await fetch('/api/quantify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            topic: t.topic,
            context: t.context,
            original_text: t.original_text,
            formula_hint: t.formula_hint,
          }),
        })
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        const loaded: FormulaTemplate[] = data.formulas ?? []
        setFormulas(loaded)
        if (loaded.length > 0) {
          setSelectedFormulaId(loaded[0].id)
          const initVars: Record<string, string> = {}
          for (const v of loaded[0].variables) {
            initVars[v.key] = v.estimated ?? ''
          }
          setVariableValues(initVars)
        }
      } catch {
        // fallback to safety net formulas on error
        setFormulas(SAFETY_NET_FORMULAS)
        setSelectedFormulaId(SAFETY_NET_FORMULAS[0].id)
        const initVars: Record<string, string> = {}
        for (const v of SAFETY_NET_FORMULAS[0].variables) {
          initVars[v.key] = v.estimated ?? ''
        }
        setVariableValues(initVars)
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    if (!trigger) {
      setFormulas([])
      setSelectedFormulaId('')
      setVariableValues({})
      setIsLoading(false)
      setIsSubmitting(false)
      return
    }

    if (isSafetyNet) {
      setFormulas(SAFETY_NET_FORMULAS)
      setSelectedFormulaId(SAFETY_NET_FORMULAS[0].id)
      const initVars: Record<string, string> = {}
      for (const v of SAFETY_NET_FORMULAS[0].variables) {
        initVars[v.key] = v.estimated ?? ''
      }
      setVariableValues(initVars)
      setIsLoading(false)
    } else {
      fetchFormulas(trigger)
    }
  }, [trigger, isSafetyNet, fetchFormulas])

  function handleFormulaSelect(formula: FormulaTemplate) {
    setSelectedFormulaId(formula.id)
    const initVars: Record<string, string> = {}
    for (const v of formula.variables) {
      initVars[v.key] = v.estimated ?? ''
    }
    setVariableValues(initVars)
  }

  function handleVariableChange(key: string, value: string) {
    setVariableValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleConfirm() {
    if (!trigger || !selectedFormula || !previewText) return
    setIsSubmitting(true)
    try {
      const entry: QuantifyEntry = {
        id: crypto.randomUUID(),
        topic: trigger.topic,
        context: trigger.context,
        result: {
          number: String(computedResult ?? ''),
          metric: selectedFormula.label,
          background: previewText,
        },
        rounds: [],
        completedAt: new Date().toISOString(),
      }
      try {
        await fetch('/api/quantify/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, entry }),
        })
      } catch {
        // submit failure is non-blocking
      }
      onComplete(entry)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSkip() {
    onComplete(null)
  }

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-40
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
      `}
      aria-hidden={!isVisible}
    >
      <div className="bg-white border-t border-secondary/20 rounded-t-2xl shadow-lg max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary/10">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500 shrink-0" />
            <span className="font-semibold text-ink">量化軍師</span>
          </div>
          <button
            onClick={onDismiss}
            aria-label="關閉"
            className="p-1.5 rounded-lg text-ink/40 hover:text-ink/70 hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Original text / context */}
          {trigger && (
            <div className="space-y-2">
              {isSafetyNet ? (
                <p className="text-sm font-medium text-ink">
                  這個主題沒有出現數字，以下是常見的 KPI，哪個最接近？
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink/60">
                    你提到：
                    <span className="inline-block bg-surface/50 rounded px-2 py-0.5 ml-1 text-ink font-medium">
                      「{trigger.original_text}」
                    </span>
                  </p>
                  {trigger.context && (
                    <p className="text-xs text-ink/50">成就摘要：{trigger.context}</p>
                  )}
                  <p className="text-sm font-medium text-ink mt-3">選擇最適合的量化公式：</p>
                </>
              )}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-secondary/10 rounded w-3/4" />
              <div className="h-4 bg-secondary/10 rounded w-1/2" />
              <div className="h-10 bg-secondary/10 rounded" />
              <div className="h-10 bg-secondary/10 rounded" />
            </div>
          )}

          {/* Formula radio buttons */}
          {!isLoading && formulas.length > 0 && (
            <div className="space-y-2">
              {formulas.map((f) => (
                <label
                  key={f.id}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer
                    transition-colors
                    ${
                      selectedFormulaId === f.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-secondary/20 text-ink hover:border-secondary/50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="formula"
                    value={f.id}
                    checked={selectedFormulaId === f.id}
                    onChange={() => handleFormulaSelect(f)}
                    className="accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-ink/40 ml-2">{f.traceFormula}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Variable fill-in fields */}
          {!isLoading && selectedFormula && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {selectedFormula.variables.map((v: FormulaVariable) => (
                  <div key={v.key} className="space-y-1">
                    <label className="text-xs font-medium text-ink/70">{v.label}</label>
                    <input
                      type="number"
                      value={variableValues[v.key] ?? ''}
                      onChange={(e) => handleVariableChange(v.key, e.target.value)}
                      placeholder={v.placeholder}
                      className="w-full px-3 py-2 text-sm border border-secondary/30 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                                 text-ink placeholder:text-ink/30"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {previewText && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-xs text-green-700 font-medium mb-1">預覽</p>
              <p className="text-sm text-green-600 font-semibold">{previewText}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-secondary/10">
          <button
            onClick={handleConfirm}
            disabled={!previewText || isSubmitting || isLoading}
            className="flex-1 py-2.5 bg-cta text-white rounded-xl text-sm font-semibold
                       hover:bg-cta/90 transition-colors disabled:opacity-40
                       flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            確認儲存
          </button>
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-sm text-ink/60 hover:text-ink
                       hover:bg-surface transition-colors disabled:opacity-40 border border-secondary/20"
          >
            沒辦法量化，略過
          </button>
        </div>
      </div>
    </div>
  )
}
