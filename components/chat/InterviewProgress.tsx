'use client'

interface InterviewProgressProps {
  gapsCompleted: number
  gapsTotal: number
  personaTitle: string
}

function getEncouragement(pct: number): string {
  if (pct >= 1) return '太棒了！所有資訊都收集完成'
  if (pct >= 0.75) return '快完成了！再多說一點就夠了'
  if (pct >= 0.5) return '快到一半了，你的經歷很精彩'
  if (pct >= 0.25) return '你說的每個細節都很有價值'
  if (pct > 0) return '很好的開始！繼續分享你的故事'
  return '讓我們開始了解你的工作經歷'
}

export function InterviewProgress({ gapsCompleted, gapsTotal, personaTitle }: InterviewProgressProps) {
  const pct = gapsTotal > 0 ? gapsCompleted / gapsTotal : 0
  const pctDisplay = Math.round(pct * 100)

  return (
    <div className="bg-surface border border-secondary/20 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink">
          目標：{personaTitle}
        </span>
        <span className="text-sm text-ink/60">
          {gapsCompleted}/{gapsTotal} 主題
        </span>
      </div>
      <div className="w-full h-1.5 bg-secondary/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink/60">{getEncouragement(pct)}</p>
    </div>
  )
}
