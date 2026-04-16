'use client'

const STEPS = ['上傳履歷', '選擇職位', '選擇年資'] as const

interface ProgressBarProps {
  currentStep: 1 | 2 | 3
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="flex items-center mb-10">
      {STEPS.map((label, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep

        return (
          <div key={label} className="contents">
            {i > 0 && (
              <div
                className={`flex-2 h-0.5 -mt-5 ${
                  isDone ? 'bg-cta' : isActive ? 'bg-primary' : 'bg-secondary/20'
                }`}
              />
            )}
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  isDone
                    ? 'bg-cta text-white'
                    : isActive
                      ? 'bg-primary text-white'
                      : 'bg-secondary/20 text-ink/40'
                }`}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium ${
                  isDone ? 'text-cta' : isActive ? 'text-primary' : 'text-ink/40'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
