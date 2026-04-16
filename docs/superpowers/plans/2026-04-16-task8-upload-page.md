# Task 8：前端上傳頁面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立首頁三步驟 wizard（上傳 → 選職位 → 選年資），引導用戶建立 session 並跳轉至訪談頁。

**Architecture:** Server Component (`page.tsx`) 在 server 端載入 career 列表，傳給 Client 子元件 (`HomeClient.tsx`) 管理 wizard state。Persona API 改為推薦 career 類別而非具體模板 ID。

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Lucide React, TypeScript

---

## File Structure

```
lib/persona/templates.ts          — 新增 CareerInfo 介面和 getCareerList()
app/api/persona/route.ts          — 改為推薦 career 類別
tests/sit/persona.test.ts         — 更新測試配合新回傳格式
components/wizard/ProgressBar.tsx  — 三步驟進度條元件
components/upload/FileUpload.tsx   — 拖曳/點擊上傳元件
components/persona/PersonaCard.tsx — 職位推薦卡片
components/persona/LevelCard.tsx   — 年資等級卡片（橫排）
components/wizard/HomeClient.tsx   — Client 端 wizard 主邏輯
app/page.tsx                       — Server Component 入口
tests/unit/components/             — 元件單元測試
```

---

## Task 1: 擴充 templates.ts — 新增 getCareerList()

**Files:**
- Modify: `lib/persona/templates.ts`
- Create: `tests/unit/templates.test.ts`

- [ ] **Step 1.1: 寫失敗測試**

Create `tests/unit/templates.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getCareerList, getPersona } from '@/lib/persona/templates'

describe('getCareerList', () => {
  it('returns 18 unique career categories', () => {
    const careers = getCareerList()
    expect(careers).toHaveLength(18)
    const ids = careers.map(c => c.id)
    expect(new Set(ids).size).toBe(18)
  })

  it('each career has id and title', () => {
    const careers = getCareerList()
    for (const career of careers) {
      expect(career.id).toBeTruthy()
      expect(career.title).toBeTruthy()
      expect(career.id).not.toMatch(/-junior$|-mid$|-senior$/)
    }
  })

  it('career id can combine with level to find a valid persona', () => {
    const careers = getCareerList()
    for (const career of careers) {
      for (const level of ['junior', 'mid', 'senior']) {
        const persona = getPersona(`${career.id}-${level}`)
        expect(persona).not.toBeNull()
      }
    }
  })
})
```

- [ ] **Step 1.2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/templates.test.ts`
Expected: FAIL — `getCareerList is not a function`

- [ ] **Step 1.3: 實作 getCareerList()**

Edit `lib/persona/templates.ts` — 在檔案末尾新增：

```typescript
export interface CareerInfo {
  id: string
  title: string
}

export function getCareerList(): CareerInfo[] {
  const templates = loadTemplates()
  const seen = new Map<string, string>()

  for (const persona of Object.values(templates)) {
    const careerId = persona.id.replace(/-(junior|mid|senior)$/, '')
    if (!seen.has(careerId)) {
      seen.set(careerId, persona.title)
    }
  }

  return Array.from(seen, ([id, title]) => ({ id, title }))
}
```

- [ ] **Step 1.4: 執行測試確認通過**

Run: `npx vitest run tests/unit/templates.test.ts`
Expected: PASS

- [ ] **Step 1.5: Commit**

```bash
git add lib/persona/templates.ts tests/unit/templates.test.ts
git commit -m "feat: add getCareerList() to templates"
```

---

## Task 2: 修改 Persona API — 推薦 career 類別

**Files:**
- Modify: `app/api/persona/route.ts`
- Modify: `tests/sit/persona.test.ts`

- [ ] **Step 2.1: 更新 SIT 測試**

Replace `tests/sit/persona.test.ts` with:
```typescript
import { describe, it, expect } from 'vitest'
import { getCareerList } from '@/lib/persona/templates'

const SAMPLE_RESUME = `
张三 | Product Manager
5年產品管理經驗，主導過電商平台從 0 到 1，管理 DAU 200萬的產品線。
熟悉數據分析工具（GA、Mixpanel），曾帶領 8 人跨功能團隊。
負責 PRD 撰寫、用戶研究、A/B 測試設計。
`

const VALID_CAREERS = new Set(getCareerList().map((c) => c.id))

describe('Persona API', () => {
  it('returns 2-3 recommendations with valid career and reason', async () => {
    const response = await fetch('http://localhost:3000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown: SAMPLE_RESUME }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data.recommendations)).toBe(true)
    expect(data.recommendations.length).toBeGreaterThanOrEqual(2)
    expect(data.recommendations.length).toBeLessThanOrEqual(3)
    for (const rec of data.recommendations) {
      expect(rec).toHaveProperty('career')
      expect(rec).toHaveProperty('title')
      expect(rec).toHaveProperty('reason')
      expect(VALID_CAREERS.has(rec.career)).toBe(true)
    }
  })

  it('returns 400 when resumeMarkdown is missing', async () => {
    const response = await fetch('http://localhost:3000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(400)
  })

  it('returns 400 when resumeMarkdown is whitespace only', async () => {
    const response = await fetch('http://localhost:3000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown: '   ' }),
    })
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2.2: 更新 Persona API route**

Replace `app/api/persona/route.ts` with:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCareerList } from '@/lib/persona/templates'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { resumeMarkdown } = await req.json()

    if (!resumeMarkdown || typeof resumeMarkdown !== 'string' || !resumeMarkdown.trim()) {
      return NextResponse.json({ error: 'resumeMarkdown is required' }, { status: 400 })
    }

    const careers = getCareerList()
    const validCareers = new Set(careers.map((c) => c.id))
    const careerList = careers
      .map((c) => `- career: "${c.id}", title: "${c.title}"`)
      .join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `你是一位資深職涯顧問。根據用戶的履歷內容，從以下職位類別中推薦最適合的 3 個，並給出簡短理由（一句話）。

可選職位類別：
${careerList}

請以 JSON 格式回應：
{
  "recommendations": [
    { "career": "career-id", "title": "職位中文名", "reason": "一句話說明為什麼推薦" }
  ]
}`,
        },
        {
          role: 'user',
          content: `以下是我的履歷：\n\n${resumeMarkdown.slice(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)

    if (!Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid OpenAI response: missing recommendations array')
    }
    parsed.recommendations = parsed.recommendations
      .filter(
        (r: any) =>
          r &&
          typeof r.career === 'string' &&
          typeof r.reason === 'string' &&
          validCareers.has(r.career)
      )
      .map((r: any) => ({
        career: r.career,
        title: careers.find((c) => c.id === r.career)?.title ?? r.title,
        reason: r.reason,
      }))
      .slice(0, 3)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Persona recommendation error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}
```

- [ ] **Step 2.3: 啟動 dev server 後執行 SIT 測試**

Run: `npx vitest run tests/sit/persona.test.ts`
Expected: PASS（需要 dev server 在 localhost:3000 運行）

- [ ] **Step 2.4: Commit**

```bash
git add app/api/persona/route.ts tests/sit/persona.test.ts
git commit -m "refactor: persona API recommends career categories instead of template IDs"
```

---

## Task 3: ProgressBar 元件

**Files:**
- Create: `components/wizard/ProgressBar.tsx`
- Create: `tests/unit/components/ProgressBar.test.tsx`

- [ ] **Step 3.1: 寫失敗測試**

Create `tests/unit/components/ProgressBar.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@/components/wizard/ProgressBar'

describe('ProgressBar', () => {
  it('renders 3 step labels', () => {
    render(<ProgressBar currentStep={1} />)
    expect(screen.getByText('上傳履歷')).toBeDefined()
    expect(screen.getByText('選擇職位')).toBeDefined()
    expect(screen.getByText('選擇年資')).toBeDefined()
  })

  it('marks completed steps with checkmark', () => {
    render(<ProgressBar currentStep={3} />)
    const checkmarks = screen.getAllByText('✓')
    expect(checkmarks).toHaveLength(2)
  })
})
```

- [ ] **Step 3.2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/components/ProgressBar.test.tsx`
Expected: FAIL

- [ ] **Step 3.3: 實作 ProgressBar**

Create `components/wizard/ProgressBar.tsx`:
```typescript
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
```

- [ ] **Step 3.4: 執行測試確認通過**

Run: `npx vitest run tests/unit/components/ProgressBar.test.tsx`
Expected: PASS

- [ ] **Step 3.5: Commit**

```bash
git add components/wizard/ProgressBar.tsx tests/unit/components/ProgressBar.test.tsx
git commit -m "feat: add ProgressBar wizard component"
```

---

## Task 4: FileUpload 元件

**Files:**
- Create: `components/upload/FileUpload.tsx`
- Create: `tests/unit/components/FileUpload.test.tsx`

- [ ] **Step 4.1: 寫失敗測試**

Create `tests/unit/components/FileUpload.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUpload } from '@/components/upload/FileUpload'

describe('FileUpload', () => {
  it('renders upload prompt', () => {
    render(<FileUpload onUploadComplete={vi.fn()} />)
    expect(screen.getByText('上傳你的履歷')).toBeDefined()
    expect(screen.getByText('PDF 或 DOCX，拖曳或點擊上傳')).toBeDefined()
  })

  it('shows loading state during upload', async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any
    render(<FileUpload onUploadComplete={vi.fn()} />)

    const input = document.getElementById('file-input') as HTMLInputElement
    const file = new File(['test'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText(/正在解析/)).toBeDefined()
  })

  it('shows error on upload failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file' }),
      })
    ) as any

    const onComplete = vi.fn()
    render(<FileUpload onUploadComplete={onComplete} />)

    const input = document.getElementById('file-input') as HTMLInputElement
    const file = new File(['test'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid file')).toBeDefined()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4.2: 執行測試確認失敗**

Run: `npx vitest run tests/unit/components/FileUpload.test.tsx`
Expected: FAIL

- [ ] **Step 4.3: 實作 FileUpload**

Create `components/upload/FileUpload.tsx`:
```typescript
'use client'
import { useState, useCallback } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'

interface FileUploadProps {
  onUploadComplete: (markdown: string) => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setIsLoading(true)
    setFileName(file.name)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onUploadComplete(data.markdown)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed'
      setError(message)
      setFileName(null)
    } finally {
      setIsLoading(false)
    }
  }, [onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging ? 'border-primary bg-primary/5' : 'border-secondary/40 hover:border-primary'}
      `}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 text-primary">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-medium">正在解析 {fileName}...</p>
        </div>
      ) : fileName && !error ? (
        <div className="flex flex-col items-center gap-3 text-primary">
          <FileText className="w-10 h-10" />
          <p className="font-medium">{fileName} 解析完成</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-ink/60">
          <Upload className="w-10 h-10" />
          <p className="text-lg font-medium text-ink">上傳你的履歷</p>
          <p className="text-sm">PDF 或 DOCX，拖曳或點擊上傳</p>
        </div>
      )}
      {error && (
        <p className="mt-3 text-red-500 text-sm">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4.4: 執行測試確認通過**

Run: `npx vitest run tests/unit/components/FileUpload.test.tsx`
Expected: PASS

- [ ] **Step 4.5: Commit**

```bash
git add components/upload/FileUpload.tsx tests/unit/components/FileUpload.test.tsx
git commit -m "feat: add FileUpload component with drag-and-drop"
```

---

## Task 5: PersonaCard 和 LevelCard 元件

**Files:**
- Create: `components/persona/PersonaCard.tsx`
- Create: `components/persona/LevelCard.tsx`
- Create: `tests/unit/components/PersonaCard.test.tsx`
- Create: `tests/unit/components/LevelCard.test.tsx`

- [ ] **Step 5.1: 寫 PersonaCard 失敗測試**

Create `tests/unit/components/PersonaCard.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonaCard } from '@/components/persona/PersonaCard'

describe('PersonaCard', () => {
  const props = {
    career: 'product-manager',
    title: '產品經理',
    reason: '你的經歷與產品規劃高度相關',
    selected: false,
    onSelect: vi.fn(),
  }

  it('renders title and reason', () => {
    render(<PersonaCard {...props} />)
    expect(screen.getByText('產品經理')).toBeDefined()
    expect(screen.getByText('你的經歷與產品規劃高度相關')).toBeDefined()
  })

  it('shows AI badge when reason is provided', () => {
    render(<PersonaCard {...props} />)
    expect(screen.getByText('AI 推薦')).toBeDefined()
  })

  it('hides AI badge and reason when reason is not provided', () => {
    render(<PersonaCard {...props} reason={undefined} />)
    expect(screen.getByText('產品經理')).toBeDefined()
    expect(screen.queryByText('AI 推薦')).toBeNull()
  })

  it('calls onSelect when clicked', () => {
    render(<PersonaCard {...props} />)
    fireEvent.click(screen.getByText('產品經理'))
    expect(props.onSelect).toHaveBeenCalled()
  })

  it('shows check icon when selected', () => {
    render(<PersonaCard {...props} selected={true} />)
    expect(screen.getByTestId('check-icon')).toBeDefined()
  })
})
```

- [ ] **Step 5.2: 實作 PersonaCard**

Create `components/persona/PersonaCard.tsx`:
```typescript
'use client'
import { CheckCircle2, Star } from 'lucide-react'

interface PersonaCardProps {
  career: string
  title: string
  reason?: string
  selected: boolean
  onSelect: () => void
}

export function PersonaCard({ title, reason, selected, onSelect }: PersonaCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        border-2 rounded-xl p-4 cursor-pointer transition-colors duration-200
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
    </div>
  )
}
```

- [ ] **Step 5.3: 執行 PersonaCard 測試確認通過**

Run: `npx vitest run tests/unit/components/PersonaCard.test.tsx`
Expected: PASS

- [ ] **Step 5.4: 寫 LevelCard 失敗測試**

Create `tests/unit/components/LevelCard.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LevelCard } from '@/components/persona/LevelCard'

describe('LevelCard', () => {
  const props = {
    level: 'mid' as const,
    label: 'Mid-level',
    years: '3-5 年',
    selected: false,
    onSelect: vi.fn(),
  }

  it('renders label and years', () => {
    render(<LevelCard {...props} />)
    expect(screen.getByText('Mid-level')).toBeDefined()
    expect(screen.getByText('3-5 年')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    render(<LevelCard {...props} />)
    fireEvent.click(screen.getByText('Mid-level'))
    expect(props.onSelect).toHaveBeenCalled()
  })

  it('applies selected style', () => {
    const { container } = render(<LevelCard {...props} selected={true} />)
    expect(container.firstElementChild?.className).toContain('border-primary')
  })
})
```

- [ ] **Step 5.5: 實作 LevelCard**

Create `components/persona/LevelCard.tsx`:
```typescript
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
```

- [ ] **Step 5.6: 執行 LevelCard 測試確認通過**

Run: `npx vitest run tests/unit/components/LevelCard.test.tsx`
Expected: PASS

- [ ] **Step 5.7: Commit**

```bash
git add components/persona/PersonaCard.tsx components/persona/LevelCard.tsx tests/unit/components/PersonaCard.test.tsx tests/unit/components/LevelCard.test.tsx
git commit -m "feat: add PersonaCard and LevelCard components"
```

---

## Task 6: HomeClient wizard 主元件 + page.tsx

**Files:**
- Create: `components/wizard/HomeClient.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 6.1: 實作 HomeClient**

Create `components/wizard/HomeClient.tsx`:
```typescript
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
    <div className="space-y-8">
      <ProgressBar currentStep={step} />

      {step === 1 && (
        <>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-ink">AI 履歷優化器</h1>
            <p className="text-ink/60">上傳履歷，讓 AI 透過訪談了解你的真實價值</p>
          </div>
          <FileUpload onUploadComplete={handleUploadComplete} />
          {isLoading && (
            <div className="text-center text-ink/60 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 正在分析你的履歷...
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
              {recommendations.map((rec) => (
                <PersonaCard
                  key={rec.career}
                  career={rec.career}
                  title={rec.title}
                  reason={rec.reason}
                  selected={selectedCareer === rec.career}
                  onSelect={() => setSelectedCareer(rec.career)}
                />
              ))}
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
  )
}
```

- [ ] **Step 6.2: 更新 page.tsx 為 Server Component**

Replace `app/page.tsx` with:
```typescript
import { getCareerList } from '@/lib/persona/templates'
import { HomeClient } from '@/components/wizard/HomeClient'

export default function HomePage() {
  const careers = getCareerList()
  return (
    <HomeClient careers={careers} />
  )
}
```

- [ ] **Step 6.3: 更新 layout.tsx 加入 max-w-2xl 容器**

Replace `app/layout.tsx` with:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI 履歷優化器',
  description: '透過 AI 訪談，讓你的履歷真正說出你的價值',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className={inter.variable}>
      <body className="min-h-screen bg-surface">
        <main className="max-w-2xl mx-auto px-4 py-12">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 6.4: Commit**

```bash
git add components/wizard/HomeClient.tsx app/page.tsx app/layout.tsx
git commit -m "feat: add wizard HomeClient with 3-step flow and update page/layout"
```

---

## Task 7: 視覺驗證

**Files:** None (manual verification)

- [ ] **Step 7.1: 啟動 dev server**

Run: `npm run dev`

- [ ] **Step 7.2: 驗證 Step 1**

Open `http://localhost:3000`:
- 進度條顯示 step 1 為藍色，step 2/3 為灰色
- 上傳區塊正確顯示，hover 時邊框變色
- 上傳 PDF/DOCX 後顯示 loading → 自動進入 Step 2

- [ ] **Step 7.3: 驗證 Step 2**

- 進度條 step 1 綠色打勾、step 2 藍色
- 顯示 3 個 AI 推薦職位卡片
- 點選卡片可選取，按「下一步」進入 Step 3

- [ ] **Step 7.4: 驗證 Step 3**

- 進度條 step 1/2 綠色打勾、step 3 藍色
- 橫排 3 張年資卡片，可點選
- 按「開始訪談」建立 session 並跳轉

- [ ] **Step 7.5: 執行所有單元測試**

Run: `npx vitest run tests/unit`
Expected: All PASS

- [ ] **Step 7.6: Final Commit**

```bash
git add -A
git commit -m "feat: complete Task 8 upload page with wizard flow"
```
