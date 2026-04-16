'use client'

interface LevelCardProps {
  level: 'junior' | 'mid' | 'senior'
  label: string
  years: string
  selected: boolean
  onSelect: () => void
}

export function LevelCard({ label, years, selected, onSelect }: LevelCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        flex-1 border-2 rounded-xl p-5 text-center cursor-pointer transition-colors duration-200
        ${selected
          ? 'border-primary bg-primary/5'
          : 'border-secondary/20 hover:border-primary/50'
        }
      `}
    >
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-sm text-ink/60 mt-1">{years}</p>
    </div>
  )
}
