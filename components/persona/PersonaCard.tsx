'use client'
import { CheckCircle2, Star } from 'lucide-react'

interface PersonaCardProps {
  career: string
  title: string
  description: string
  reason?: string
  selected: boolean
  onSelect: () => void
}

export function PersonaCard({ title, description, reason, selected, onSelect }: PersonaCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        group relative border-2 rounded-xl p-4 cursor-pointer transition-colors duration-200
        ${selected
          ? 'border-primary bg-primary/5'
          : 'border-secondary/30 hover:border-primary/50'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink">{title}</h3>
            {reason && (
              <span className="flex items-center gap-1 text-xs text-cta font-medium">
                <Star className="w-3 h-3 fill-cta" />
                AI 推薦
              </span>
            )}
          </div>
          {reason && <p className="text-sm text-primary">{reason}</p>}
        </div>
        {selected && <CheckCircle2 data-testid="check-icon" className="w-5 h-5 text-primary flex-shrink-0" />}
      </div>
      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-secondary/20
        rounded-lg px-4 py-3 text-sm text-ink/60 leading-relaxed shadow-md
        opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all duration-200 z-10 pointer-events-none">
        {description}
      </div>
    </div>
  )
}
