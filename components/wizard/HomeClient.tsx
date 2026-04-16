'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ProgressBar } from '@/components/wizard/ProgressBar'
import { FileUpload } from '@/components/upload/FileUpload'
import { PersonaCard } from '@/components/persona/PersonaCard'
import { LevelCard } from '@/components/persona/LevelCard'

interface CareerInfo {
  id: string
  title: string
  description: string
}

interface Recommendation {
  career: string
  title: string
  reason: string
}

const LEVELS = [
  { level: 'junior' as const, label: 'Junior', years: '0-2 年' },
  { level: 'mid' as const, label: 'Mid-level', years: '3-5 年' },
  { level: 'senior' as const, label: 'Senior', years: '6+ 年' },
]

interface HomeClientProps {
  careers: CareerInfo[]
}

export function HomeClient({ careers }: HomeClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [resumeMarkdown, setResumeMarkdown] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<'junior' | 'mid' | 'senior' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllCareers, setShowAllCareers] = useState(false)

  async function handleUploadComplete(markdown: string) {
    setResumeMarkdown(markdown)
    setIsLoading(true)
    try {
      const res = await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeMarkdown: markdown }),
      })
      const data = await res.json()
      setRecommendations(data.recommendations ?? [])
    } catch {
      setRecommendations([])
    } finally {
      setIsLoading(false)
      setStep(2)
    }
  }

  async function handleStartInterview() {
    if (!selectedCareer || !selectedLevel) return
    setError(null)
    setIsLoading(true)
    try {
      const personaId = `${selectedCareer}-${selectedLevel}`
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeMarkdown, personaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create session')
      router.push(`/session/${data.session.id}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create session'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl w-full mx-auto px-4 pt-16 pb-12">
    <div className="space-y-8">
      <ProgressBar currentStep={step} />

      {step === 1 && (
        <>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-ink">AI 履歷優化器</h1>
            <p className="text-ink/60">上傳履歷，讓 AI 透過訪談挖掘你的真實成就</p>
          </div>
          <FileUpload onUploadComplete={handleUploadComplete} />
          {isLoading && (
            <div className="bg-white rounded-xl border border-secondary/20 px-4 py-3 flex items-center gap-3 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">AI 正在分析你的履歷</p>
                <p className="text-xs text-ink/40">找出最適合的職位方向...</p>
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && (() => {
        const recommendedIds = new Set(recommendations.map((r) => r.career))
        const otherCareers = careers.filter((c) => !recommendedIds.has(c.id))

        return (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-ink">選擇目標職位</h1>
              <p className="text-ink/60">根據你的履歷，AI 推薦以下方向</p>
            </div>
            <div className="space-y-3">
              {recommendations.map((rec) => {
                const careerInfo = careers.find((c) => c.id === rec.career)
                return (
                  <PersonaCard
                    key={rec.career}
                    career={rec.career}
                    title={rec.title}
                    description={careerInfo?.description ?? ''}
                    reason={rec.reason}
                    selected={selectedCareer === rec.career}
                    onSelect={() => setSelectedCareer(rec.career)}
                  />
                )
              })}
            </div>

            {!showAllCareers && otherCareers.length > 0 && (
              <button
                onClick={() => setShowAllCareers(true)}
                className="w-full py-3 text-sm text-primary font-medium hover:text-primary/80
                  cursor-pointer transition-colors duration-200"
              >
                查看全部職位 ({otherCareers.length})
              </button>
            )}

            {showAllCareers && (
              <div className="space-y-3">
                <p className="text-sm text-ink/40 font-medium">其他職位</p>
                {otherCareers.map((career) => (
                  <PersonaCard
                    key={career.id}
                    career={career.id}
                    title={career.title}
                    description={career.description}
                    selected={selectedCareer === career.id}
                    onSelect={() => setSelectedCareer(career.id)}
                  />
                ))}
              </div>
            )}

            <button
              onClick={() => { if (selectedCareer) setStep(3) }}
              disabled={!selectedCareer}
              className="w-full py-4 rounded-xl bg-cta text-white font-semibold text-lg
                cursor-pointer transition-colors duration-200
                hover:bg-cta/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一步
            </button>
          </>
        )
      })()}

      {step === 3 && (
        <>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-ink">選擇目標年資</h1>
            <p className="text-ink/60">
              {recommendations.find((r) => r.career === selectedCareer)?.title
                ?? careers.find((c) => c.id === selectedCareer)?.title
                ?? selectedCareer}
            </p>
          </div>
          <div className="flex gap-3">
            {LEVELS.map((l) => (
              <LevelCard
                key={l.level}
                level={l.level}
                label={l.label}
                years={l.years}
                selected={selectedLevel === l.level}
                onSelect={() => setSelectedLevel(l.level)}
              />
            ))}
          </div>
          <button
            onClick={handleStartInterview}
            disabled={!selectedLevel || isLoading}
            className="w-full py-4 rounded-xl bg-cta text-white font-semibold text-lg
              cursor-pointer transition-colors duration-200
              hover:bg-cta/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                建立中...
              </span>
            ) : (
              '開始訪談'
            )}
          </button>
          {error && <p className="text-center text-red-500 text-sm">{error}</p>}
        </>
      )}
    </div>
    </div>
  )
}
