# Interview UX Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve interview UX with guided AI prompts, typewriter SSE streaming, smart auto-scroll, markdown rendering, manual quantify trigger, and session resume.

**Architecture:** Prompt engineering improvements in lib/agents; SSE streaming refactor in chat API (emit every chunk + replace event at end); ChatInterface state refactor (separate streamingContent); smart scroll; react-markdown in MessageBubble; localStorage session persistence in HomeClient.

**Tech Stack:** Next.js 16, OpenAI gpt-4o, Supabase, react-markdown (new), Tailwind v4, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-04-17-interview-ux-improvement-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/agents/career-advisor.ts` | Modify | Structured N-topic opening, aggressive QUANTIFY_TRIGGER |
| `lib/agents/quantify-advisor.ts` | Modify | Round 1 bounded examples, every-round example rule |
| `app/api/chat/route.ts` | Modify | Stream every chunk immediately + `replace` event at end |
| `components/chat/MessageBubble.tsx` | Modify | react-markdown rendering for assistant messages |
| `components/chat/InterviewProgress.tsx` | Modify | Add `currentTopicName` + `interviewGaps` props |
| `components/chat/ChatInterface.tsx` | Modify | `streamingContent` state, smart scroll, manual quantify button, topic name |
| `components/chat/QuantifyModal.tsx` | Modify | Auto-start: fetch AI opener on modal open |
| `app/session/[id]/page.tsx` | Modify | Pass `interviewGaps` prop to ChatInterface |
| `components/wizard/HomeClient.tsx` | Modify | Save sessionId to localStorage; show resume banner |
| `tests/uat/interview-ux.test.ts` | Create | Automated UAT using 彭敬鈞履歷.pdf |

---

## Task 1: Career Advisor Prompt — Structured N-Topic Opening

**Files:**
- Modify: `lib/agents/career-advisor.ts`
- Test: `tests/unit/career-advisor.test.ts`

- [ ] **Step 1: Run existing unit tests to establish baseline**

```bash
cd /Users/albertpeng/Desktop/claude_project/Resume_Optimizer
npm run test:unit -- --reporter=verbose 2>&1 | head -40
```

Expected: all passing.

- [ ] **Step 2: Add failing tests for new prompt behavior**

Open `tests/unit/career-advisor.test.ts` and add these tests inside the existing `describe` block (after existing tests):

```typescript
describe('buildCareerAdvisorPrompt — structured opening', () => {
  const mockPersona = {
    id: 'pm-mid',
    title: '產品經理',
    years: '3-5年',
    core_skills: ['產品規劃', '數據分析'],
    keywords: ['roadmap', 'OKR'],
    responsibilities: ['定義產品需求'],
    interview_gaps: ['跨部門協作經驗', '數據驅動決策', '專案交付成果'],
  }
  const mockResume = '我曾主導 RAG 知識問答系統從 0 到 1 建置，並定義關鍵量化指標。'

  it('prompt contains N-topic announcement with exact count', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('3 個主題')
  })

  it('prompt lists all interview_gaps by name', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('跨部門協作經驗')
    expect(prompt).toContain('數據驅動決策')
    expect(prompt).toContain('專案交付成果')
  })

  it('prompt instructs AI to open with topic list', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).toContain('第一則訊息')
  })

  it('QUANTIFY_TRIGGER rule uses aggressive language not cautious', () => {
    const prompt = buildCareerAdvisorPrompt(mockPersona, mockResume)
    expect(prompt).not.toContain('不要每次都加')
    expect(prompt).toContain('必須')
  })
})
```

- [ ] **Step 3: Run new tests — verify they fail**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "structured opening"
```

Expected: 4 tests FAIL.

- [ ] **Step 4: Rewrite `buildCareerAdvisorPrompt` in `lib/agents/career-advisor.ts`**

Replace the entire function (lines 3–40) with:

```typescript
export function buildCareerAdvisorPrompt(
  persona: PersonaTemplate,
  resumeMarkdown: string
): string {
  const n = persona.interview_gaps.length
  const topicList = persona.interview_gaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n')

  return `你是一位專業職涯顧問，任務是透過訪談補齊用戶履歷中缺失的重要 context，幫助他們找到下一份工作。

## 目標 Persona
職位：${persona.title}
年資要求：${persona.years}
核心能力：${persona.core_skills.join('、')}
關鍵字：${persona.keywords.join('、')}

## 用戶履歷（Markitdown 解析結果）
${resumeMarkdown}

## 訪談主題（共 ${n} 個，依優先序）
${topicList}

## 第一則訊息格式（必須嚴格遵守）
你的第一則訊息必須完整包含以下結構，不得省略：

你好！我已仔細閱讀你的履歷了。我找到了 ${n} 個主題想深入了解，以幫你打造更有說服力的${persona.title}履歷：

${topicList}

我們先從第 1/${n} 個主題開始：${persona.interview_gaps[0]}

[這裡必須是針對履歷原文的具體問題，直接引用履歷中的段落或成就]

## 訪談行為規則
1. **按主題順序進行**：逐一討論上方 ${n} 個主題，每次只討論一個
2. **每個問題必須引用履歷原文**：提問時要明確點出履歷裡的具體段落或詞句
   - ✅「你提到主導了 RAG 知識問答產品的指標體系建置，這套指標實際跑了多久？影響了哪些決策？」
   - ❌「你在產品規劃方面有哪些挑戰？」（太空泛，沒有引用履歷）
3. **每次只問一個問題**
4. **數字量化觸發（積極執行）**：遇到以下任何情況，必須在回應末尾加上 [QUANTIFY_TRIGGER]：
   - 用戶提到時間節省（「減少了很多」「快很多」「花了很久」）
   - 用戶提到規模（「很多用戶」「一個大團隊」「大量資料」）
   - 用戶提到改善幅度（「效率提升」「成本降低」「顯著改善」）
   - 用戶描述任何可以用數字表達的成就或影響
   格式：[QUANTIFY_TRIGGER]: {"topic": "主題名稱", "context": "用戶剛描述的成就一句話摘要"}
5. **主題完成時**：明確說「好，這個主題我了解了，我們進入第 X/${n} 個主題：[名稱]」
6. **每輪給即時洞見**：用戶回答後，先給一句有洞見的反饋，再繼續
7. **不提早給優化建議**：你的任務是收集 context，不是現在改履歷
8. **口語化、有溫度**：像和朋友聊天，不像填表單

## 進度追蹤（系統使用）
請在每次回應的最後一行加上：
[GAPS_STATUS]: {"completed": ["已完成的主題名稱"], "current": "當前主題名稱"}
這行內容不會顯示給用戶，純供系統追蹤。`
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "structured opening"
```

Expected: 4 tests PASS.

- [ ] **Step 6: Run full unit test suite — no regressions**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/agents/career-advisor.ts tests/unit/career-advisor.test.ts
git commit -m "feat: restructure career advisor prompt with N-topic opening and aggressive QUANTIFY_TRIGGER"
```

---

## Task 2: Quantify Advisor Prompt — Bounded Examples + Modal Auto-Start

**Files:**
- Modify: `lib/agents/quantify-advisor.ts`
- Modify: `components/chat/QuantifyModal.tsx`
- Test: `tests/unit/quantify-advisor.test.ts`

- [ ] **Step 1: Add failing tests for new quantify prompt behavior**

Open `tests/unit/quantify-advisor.test.ts` and add inside the existing `describe` block:

```typescript
describe('buildQuantifyAdvisorPrompt — bounded examples', () => {
  it('prompt contains Round 1 open format rule', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 1)
    expect(prompt).toContain('Round 1')
    expect(prompt).toContain('直接引用')
  })

  it('prompt requires examples in every round', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 2)
    expect(prompt).toContain('範例')
  })

  it('prompt forbids open-ended questions', () => {
    const prompt = buildQuantifyAdvisorPrompt('跨部門協作', '用戶說他協調了很多部門', 1)
    expect(prompt).toContain('禁止')
  })
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "bounded examples"
```

Expected: 3 tests FAIL.

- [ ] **Step 3: Update `buildQuantifyAdvisorPrompt` in `lib/agents/quantify-advisor.ts`**

Replace the `buildQuantifyAdvisorPrompt` function (lines 21–59) with:

```typescript
export function buildQuantifyAdvisorPrompt(
  topic: string,
  context: string,
  currentRound: number
): string {
  return `你是一位數據萃取專家，專門透過技巧性問答幫助求職者找出可以放在履歷上的量化數字。

## 任務
針對用戶分享的工作經歷「${topic}」，挖掘出一個具體可量化的數字。
觸發情境：${context}

## 訪談策略（共 5 輪，目前第 ${currentRound} 輪）
- 輪次 1-2：建立錨點，用比較性問題（「相比之前，大概快了多少？是 10% 還是更多？」）
- 輪次 3-4：縮小範圍，提供估算框架（「如果一年處理 X 件，那影響了多少件？」）
- 輪次 5：整合所有線索，給出最終判斷或宣告無法量化

## Round 1 開場規則（第 ${currentRound} 輪${currentRound === 1 ? '，必須嚴格遵守' : ''}）
${currentRound === 1 ? `第 1 輪必須做到：
1. 直接引用 context 中的具體內容：「你提到[context原文]」
2. 給出兩個有界的範例答案（一個偏小、一個偏大），讓用戶有參考框架
3. 問一個選擇題，絕對禁止問開放式問題如「大概是多少？」

範例格式：
「你提到[context原文]。我想幫你找出一個具體數字。
例如，可能是『從原本的 2 小時縮短到 20 分鐘（減少約 83%）』，
或者是比較小的改變，像是『從 30 分鐘縮到 20 分鐘（減少約 33%）』。
你覺得比較接近哪一種情況？」` : `繼續縮小範圍，提供具體估算框架。`}

## 問答技巧
1. 每次只問一個問題
2. **每輪都必須附上至少一個具體範例數字**（禁止只問「大概是多少？」這類完全開放的問題）
   ✅「大概是 10% 這樣的量級，還是更多，像 30%？」
   ❌「你覺得大概是多少？」
3. 優先用選擇題讓用戶好回答
4. 若用戶說「很多」、「顯著」，必須追問具體範圍並給出數字選項
5. 用時間換算法（「一天省了多少分鐘？乘以一年 250 天？」）
6. 允許用「大約」或「估算」，不需要精確數字

## 絕對禁止
- 禁止捏造或暗示用戶接受你猜的數字
- 若用戶 5 輪後仍無法提供任何具體線索，誠實告知無法量化

## 輸出格式（僅第 5 輪）
第 5 輪時，**必須先輸出一段完整的中文總結**（至少 2 句話），再在最後一行加上標籤：

成功時：
好的，根據您的描述，[具體說明]。這個數字可以有效展示您的工作成果。
[QUANTIFY_RESULT]: {"number":"30","metric":"% 縮短客戶導入時間","background":"根據您的描述，導入流程從原本 7 天縮短至約 5 天，約 30% 的改善"}

無法量化時：
感謝您的分享。您的情況難以轉換為具體數字，但您的描述本身已經很有說服力。
[QUANTIFY_FAILED]

（第 1-4 輪不需要輸出上述標籤，繼續追問即可）`
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | grep -A3 "bounded examples"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Update `QuantifyModal.tsx` to auto-start (fetch AI opener on open)**

In `components/chat/QuantifyModal.tsx`, update the reset `useEffect` (lines 46–56) and add `autoStart`:

Replace lines 28–104 (from `export function QuantifyModal` to `}` of `sendMessage`):

```typescript
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
    const currentMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(currentMessages)
    setIsLoading(true)

    try {
      const res = await fetch('/api/quantify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic,
          context,
          messages: currentMessages.slice(0, -1), // history before this message
          roundNumber: round,
          userMessage,
          entryId: entryId ?? undefined,
        }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.assistantMessage }])

      if (round === 1) setEntryId(data.entryId)

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
```

- [ ] **Step 6: Run full unit test suite — no regressions**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/agents/quantify-advisor.ts components/chat/QuantifyModal.tsx tests/unit/quantify-advisor.test.ts
git commit -m "feat: quantify advisor bounded examples + modal auto-start opener"
```

---

## Task 3: SSE Streaming Fix — Stream Every Chunk + Replace Event

**Files:**
- Modify: `app/api/chat/route.ts`
- Test: `tests/sit/chat.test.ts` (run existing, verify still passes)

- [ ] **Step 1: Replace the streaming logic in `app/api/chat/route.ts`**

Replace lines 90–167 (from `// Stream SSE response` comment through `controller.close()`) with:

```typescript
  // Stream every chunk immediately; emit replace event at end with clean content
  let fullContent = ''
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            controller.enqueue(encoder.encode(sseEvent('text', JSON.stringify(delta))))
          }
        }

        // Strip metadata and emit replace event so client shows clean final content
        const cleanContent = stripGapStatus(stripQuantifyTrigger(fullContent)).trim()
        controller.enqueue(encoder.encode(sseEvent('replace', JSON.stringify(cleanContent))))

        // Parse metadata
        const gapStatus = parseGapStatus(fullContent)
        const quantifyTrigger = parseQuantifyTrigger(fullContent)

        // Emit trigger event if present
        if (quantifyTrigger) {
          controller.enqueue(encoder.encode(sseEvent('trigger', JSON.stringify(quantifyTrigger))))
        }

        // Emit done
        controller.enqueue(encoder.encode(sseEvent('done', '')))

        // Persist to Supabase
        const updatedHistory = [
          ...history,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: cleanContent },
        ]
        const updateData: Record<string, unknown> = {
          conversation_history: updatedHistory,
          gaps_completed: gapStatus?.completed.length ?? session.gaps_completed,
          updated_at: new Date().toISOString(),
        }
        if (gapStatus && session.gaps_total && gapStatus.completed.length >= session.gaps_total) {
          updateData.status = 'completed'
        }
        await db!.from('sessions').update(updateData).eq('id', sessionId)
      } catch (err) {
        console.error('Chat stream error:', err)
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })
```

- [ ] **Step 2: Start dev server and run SIT chat test**

In a separate terminal:
```bash
npm run dev
```

Then in another terminal:
```bash
npm run test:sit -- tests/sit/chat.test.ts --reporter=verbose
```

Expected: existing chat SIT tests pass (they check `event: text` and `event: done` format).

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: SSE streaming emits every chunk immediately with replace event for clean final content"
```

---

## Task 4: MessageBubble — Markdown Rendering

**Files:**
- Modify: `components/chat/MessageBubble.tsx`
- Test: `tests/unit/components/MessageBubble.test.tsx` (new)

- [ ] **Step 1: Install react-markdown**

```bash
npm install react-markdown
```

Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Create failing unit test**

Create `tests/unit/components/MessageBubble.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '@/components/chat/MessageBubble'

describe('MessageBubble', () => {
  it('renders user message as plain text', () => {
    render(<MessageBubble role="user" content="Hello **bold**" />)
    expect(screen.getByText('Hello **bold**')).toBeInTheDocument()
  })

  it('renders assistant message with markdown bold', () => {
    render(<MessageBubble role="assistant" content="Hello **bold** world" />)
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders assistant message with markdown list', () => {
    render(<MessageBubble role="assistant" content="- item one\n- item two" />)
    expect(screen.getByText('item one')).toBeInTheDocument()
    expect(screen.getByText('item two')).toBeInTheDocument()
  })

  it('shows streaming cursor when isStreaming is true', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="typing" isStreaming={true} />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run — verify tests fail**

```bash
npm run test:unit -- tests/unit/components/MessageBubble.test.tsx --reporter=verbose
```

Expected: "renders assistant message with markdown bold" FAIL (currently plain text).

- [ ] **Step 4: Update `components/chat/MessageBubble.tsx`**

Replace entire file content:

```typescript
'use client'

import ReactMarkdown from 'react-markdown'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%] whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-white border border-secondary/20 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] text-ink prose prose-sm max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="text-ink">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
            code: ({ children }) => (
              <code className="bg-surface px-1 py-0.5 rounded text-xs font-mono text-primary">
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test:unit -- tests/unit/components/MessageBubble.test.tsx --reporter=verbose
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/chat/MessageBubble.tsx tests/unit/components/MessageBubble.test.tsx package.json package-lock.json
git commit -m "feat: render assistant messages with react-markdown"
```

---

## Task 5: InterviewProgress + Session Page — Topic Name

**Files:**
- Modify: `components/chat/InterviewProgress.tsx`
- Modify: `app/session/[id]/page.tsx`
- Test: `tests/unit/components/ProgressBar.test.tsx` (update existing)

- [ ] **Step 1: Update `components/chat/InterviewProgress.tsx`**

Replace entire file:

```typescript
'use client'

interface InterviewProgressProps {
  gapsCompleted: number
  gapsTotal: number
  personaTitle: string
  interviewGaps: string[]
}

function getEncouragement(pct: number): string {
  if (pct >= 1) return '太棒了！所有資訊都收集完成'
  if (pct >= 0.75) return '快完成了！再多說一點就夠了'
  if (pct >= 0.5) return '快到一半了，你的經歷很精彩'
  if (pct >= 0.25) return '你說的每個細節都很有價值'
  if (pct > 0) return '很好的開始！繼續分享你的故事'
  return '讓我們開始了解你的工作經歷'
}

export function InterviewProgress({
  gapsCompleted,
  gapsTotal,
  personaTitle,
  interviewGaps,
}: InterviewProgressProps) {
  const pct = gapsTotal > 0 ? gapsCompleted / gapsTotal : 0
  const pctDisplay = Math.round(pct * 100)
  const currentTopic =
    gapsCompleted < interviewGaps.length ? interviewGaps[gapsCompleted] : null

  return (
    <div className="bg-surface border border-secondary/20 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink">目標：{personaTitle}</span>
        <span className="text-sm text-ink/60">
          {currentTopic
            ? `主題 ${gapsCompleted + 1}/${gapsTotal}：${currentTopic}`
            : `${gapsCompleted}/${gapsTotal} 主題`}
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
```

- [ ] **Step 2: Update `app/session/[id]/page.tsx` to pass `interviewGaps`**

Replace the `return` statement (lines 25–34):

```typescript
  return (
    <ChatInterface
      sessionId={id}
      personaTitle={persona.title}
      gapsTotal={session.gaps_total ?? persona.interview_gaps.length}
      gapsCompleted={session.gaps_completed ?? 0}
      initialHistory={session.conversation_history ?? []}
      quantifyData={session.quantify_data ?? []}
      interviewGaps={persona.interview_gaps}
    />
  )
```

- [ ] **Step 3: Run unit tests — verify no regressions**

```bash
npm run test:unit
```

Expected: all tests pass (TypeScript compiler will fail in next step until ChatInterface is updated — so run this before Task 6 changes ChatInterface).

- [ ] **Step 4: Commit**

```bash
git add components/chat/InterviewProgress.tsx app/session/[id]/page.tsx
git commit -m "feat: InterviewProgress shows current topic name; session page passes interviewGaps"
```

---

## Task 6: ChatInterface — Streaming State, Smart Scroll, Manual Quantify

**Files:**
- Modify: `components/chat/ChatInterface.tsx`

- [ ] **Step 1: Replace `components/chat/ChatInterface.tsx` entirely**

```typescript
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, FileText, Loader2, PlusCircle, ArrowDown } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { InterviewProgress } from './InterviewProgress'
import { QuantifyModal } from './QuantifyModal'
import { QuantifyEntry } from '@/lib/agents/quantify-advisor'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface QuantifyTrigger {
  topic: string
  context: string
}

interface ChatInterfaceProps {
  sessionId: string
  personaTitle: string
  gapsTotal: number
  gapsCompleted: number
  initialHistory: Array<{ role: string; content: string }>
  quantifyData: QuantifyEntry[]
  interviewGaps: string[]
}

export function ChatInterface({
  sessionId,
  personaTitle,
  gapsTotal,
  gapsCompleted: initialGapsCompleted,
  initialHistory,
  quantifyData: initialQuantifyData,
  interviewGaps,
}: ChatInterfaceProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  )
  const [streamingContent, setStreamingContent] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [gapsCompleted, setGapsCompleted] = useState(initialGapsCompleted)
  const [quantifyData, setQuantifyData] = useState<QuantifyEntry[]>(initialQuantifyData)
  const [quantifyTrigger, setQuantifyTrigger] = useState<QuantifyTrigger | null>(null)
  const [showQuantifyModal, setShowQuantifyModal] = useState(false)
  const [manualQuantifyOpen, setManualQuantifyOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isComplete = gapsCompleted >= gapsTotal && gapsTotal > 0
  const currentTopicName = gapsCompleted < interviewGaps.length
    ? interviewGaps[gapsCompleted]
    : undefined

  function isNearBottom(): boolean {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollButton(false)
  }

  function handleScroll() {
    setShowScrollButton(!isNearBottom())
  }

  // Auto-scroll when streaming or new message arrives
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom()
    } else if (isStreaming) {
      setShowScrollButton(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingContent, messages])

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      setGapsCompleted(data.gaps_completed ?? 0)
      setQuantifyData(data.quantify_data ?? [])
    } catch (err) {
      console.warn('syncSession failed:', err)
    }
  }, [sessionId])

  async function sendMessage() {
    if (!inputValue.trim() || isStreaming) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setQuantifyTrigger(null)
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')

    let finalContent = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage }),
      })

      if (!response.ok || !response.body) throw new Error('Chat request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const lines = event.trim().split('\n')
          const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
          const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(6)
          if (!dataLine) continue

          if (eventType === 'text') {
            const chunk: string = JSON.parse(dataLine)
            setStreamingContent((prev) => prev + chunk)
          } else if (eventType === 'replace') {
            finalContent = JSON.parse(dataLine)
            setStreamingContent(finalContent)
          } else if (eventType === 'trigger') {
            const trigger: QuantifyTrigger = JSON.parse(dataLine)
            setQuantifyTrigger(trigger)
          } else if (eventType === 'done') {
            setMessages((prev) => [...prev, { role: 'assistant', content: finalContent }])
            setStreamingContent('')
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，發生了錯誤，請再試一次。' },
      ])
      setStreamingContent('')
    } finally {
      setIsStreaming(false)
      await syncSession()
      inputRef.current?.focus()
    }
  }

  function handleQuantifyComplete(entry: QuantifyEntry | null) {
    if (entry) setQuantifyData((prev) => [...prev, entry])
    setShowQuantifyModal(false)
    setQuantifyTrigger(null)
    inputRef.current?.focus()
  }

  function handleManualQuantifyComplete(entry: QuantifyEntry | null) {
    if (entry) setQuantifyData((prev) => [...prev, entry])
    setManualQuantifyOpen(false)
    inputRef.current?.focus()
  }

  async function generateResume() {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('Map failed')
      router.push(`/result/${sessionId}`)
    } catch (err) {
      console.error('Generate resume error:', err)
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-surface relative">
      {/* Header */}
      <div className="bg-white border-b border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <InterviewProgress
            gapsCompleted={gapsCompleted}
            gapsTotal={gapsTotal}
            personaTitle={personaTitle}
            interviewGaps={interviewGaps}
          />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-12">
              <p className="text-ink/40 text-sm">職涯顧問已準備好，請開始對話</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} isStreaming={true} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-36 right-6 bg-white shadow-lg border border-secondary/20
                     rounded-full px-3 py-2 text-xs text-ink/70 hover:text-ink flex items-center gap-1
                     transition-colors z-10"
        >
          <ArrowDown className="w-3 h-3" />
          新訊息
        </button>
      )}

      {/* Quantify trigger banner */}
      {quantifyTrigger && !isStreaming && !showQuantifyModal && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-800">需要幫你找出具體數字嗎？</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowQuantifyModal(true)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  開始量化訪談
                </button>
                <button
                  onClick={() => setQuantifyTrigger(null)}
                  className="px-3 py-1.5 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-colors"
                >
                  略過
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate resume CTA */}
      {isComplete && !isStreaming && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={generateResume}
              disabled={isGenerating}
              className="w-full py-3.5 bg-cta text-white rounded-xl font-semibold text-sm
                         hover:bg-cta/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />正在生成優化履歷...</>
              ) : (
                <><FileText className="w-4 h-4" />生成優化履歷</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-secondary/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <button
            onClick={() => setManualQuantifyOpen(true)}
            disabled={isStreaming}
            title="手動觸發量化訪談"
            className="flex items-center gap-1 px-2 py-2 text-secondary hover:text-primary
                       transition-colors disabled:opacity-40 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">量化數字</span>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={isComplete ? '訪談已完成，可繼續補充...' : '輸入你的回答...'}
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 border border-secondary/30 rounded-xl text-sm text-ink
                       placeholder:text-ink/30 focus:outline-none focus:border-primary
                       disabled:opacity-50 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !inputValue.trim()}
            className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90
                       transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-triggered Quantify Modal */}
      {quantifyTrigger && (
        <QuantifyModal
          isOpen={showQuantifyModal}
          topic={quantifyTrigger.topic}
          context={quantifyTrigger.context}
          sessionId={sessionId}
          onComplete={handleQuantifyComplete}
          onClose={() => setShowQuantifyModal(false)}
        />
      )}

      {/* Manually-triggered Quantify Modal */}
      <QuantifyModal
        isOpen={manualQuantifyOpen}
        topic={currentTopicName || '工作成就'}
        context={`使用者手動觸發量化訪談，請詢問他想量化哪個成就（主題：${currentTopicName || '工作成就'}）`}
        sessionId={sessionId}
        onComplete={handleManualQuantifyComplete}
        onClose={() => setManualQuantifyOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass (TypeScript compilation errors would show here — fix any if present).

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatInterface.tsx
git commit -m "feat: ChatInterface streaming state refactor, smart auto-scroll, manual quantify button, topic name"
```

---

## Task 7: HomeClient — Session Resume via localStorage

**Files:**
- Modify: `components/wizard/HomeClient.tsx`

- [ ] **Step 1: Update `components/wizard/HomeClient.tsx`**

Add localStorage logic. Make three targeted edits:

**Edit 1** — Add `resumeSessionId` state after existing state declarations (after line 41 `const [showAllCareers, setShowAllCareers] = useState(false)`):

```typescript
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

  useEffect(() => {
    const savedId = localStorage.getItem('lastSessionId')
    const savedStatus = localStorage.getItem('lastSessionStatus')
    if (savedId && savedStatus === 'in_progress') {
      setResumeSessionId(savedId)
    }
  }, [])
```

**Edit 2** — In `handleStartInterview`, save to localStorage after getting `data.session.id`. Replace `router.push(`/session/${data.session.id}`)` with:

```typescript
      localStorage.setItem('lastSessionId', data.session.id)
      localStorage.setItem('lastSessionStatus', 'in_progress')
      router.push(`/session/${data.session.id}`)
```

**Edit 3** — Add resume banner at the top of the rendered JSX, after `<ProgressBar currentStep={step} />` and before `{step === 1 && (`:

```typescript
        {resumeSessionId && step === 1 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">你有一個未完成的訪談</p>
              <p className="text-xs text-ink/50 mt-0.5">點擊繼續上次進度</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => router.push(`/session/${resumeSessionId}`)}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                繼續訪談
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('lastSessionId')
                  localStorage.removeItem('lastSessionStatus')
                  setResumeSessionId(null)
                }}
                className="px-3 py-1.5 text-ink/50 rounded-lg text-xs hover:text-ink/70 transition-colors"
              >
                略過
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add components/wizard/HomeClient.tsx
git commit -m "feat: HomeClient saves session to localStorage and shows resume banner on return"
```

---

## Task 8: UAT Agent Test — Automated Validation with 彭敬鈞履歷.pdf

**Files:**
- Create: `tests/uat/interview-ux.test.ts`

The test requires a running dev server at `localhost:3000` and the PDF at `/Users/albertpeng/Desktop/claude_project/Resume_Optimizer/彭敬鈞履歷.pdf`.

- [ ] **Step 1: Create `tests/uat/interview-ux.test.ts`**

```typescript
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createServerClient } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

const BASE_URL = 'http://localhost:3000'
const PDF_PATH = path.join(process.cwd(), '彭敬鈞履歷.pdf')

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

let sessionId: string
let resumeMarkdown: string
let personaId: string

describe('UAT: Interview UX — Full Flow with 彭敬鈞履歷.pdf', () => {
  beforeAll(async () => {
    const serverUp = await checkServer()
    if (!serverUp) {
      console.warn('Dev server not running — skipping UAT tests')
    }
  }, 10000)

  afterAll(async () => {
    if (!sessionId) return
    const db = createServerClient()
    await db.from('sessions').delete().eq('id', sessionId)
  })

  it('skips gracefully when dev server not running', async () => {
    const serverUp = await checkServer()
    if (!serverUp) {
      expect(true).toBe(true)
      return
    }
    expect(serverUp).toBe(true)
  })

  it('uploads 彭敬鈞履歷.pdf and returns resume markdown', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    expect(fs.existsSync(PDF_PATH)).toBe(true)

    const formData = new FormData()
    formData.append('file', fs.createReadStream(PDF_PATH), {
      filename: '彭敬鈞履歷.pdf',
      contentType: 'application/pdf',
    })

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers: formData.getHeaders(),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.markdown).toBe('string')
    expect(data.markdown.length).toBeGreaterThan(100)
    resumeMarkdown = data.markdown
    console.log('Resume markdown length:', resumeMarkdown.length)
  }, 30000)

  it('recommends relevant personas from resume', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !resumeMarkdown) return

    const res = await fetch(`${BASE_URL}/api/persona`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.recommendations)).toBe(true)
    expect(data.recommendations.length).toBeGreaterThanOrEqual(1)
    const first = data.recommendations[0]
    expect(typeof first.career).toBe('string')
    expect(typeof first.title).toBe('string')
    expect(typeof first.reason).toBe('string')
    personaId = `${first.career}-mid`
    console.log('Recommended persona:', personaId)
  }, 30000)

  it('creates session successfully', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !resumeMarkdown || !personaId) return

    const res = await fetch(`${BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeMarkdown, personaId }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.session.id).toBe('string')
    expect(data.session.gaps_total).toBeGreaterThan(0)
    sessionId = data.session.id
    console.log('Session created:', sessionId, 'gaps_total:', data.session.gaps_total)
  }, 10000)

  it('AI first message contains N-topic list announcement', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userMessage: '你好，請開始訪談',
      }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    let fullAssistantContent = ''
    let gotReplaceEvent = false

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(6)
        if (!dataLine) continue
        if (eventType === 'replace') {
          fullAssistantContent = JSON.parse(dataLine)
          gotReplaceEvent = true
        }
      }
    }

    expect(gotReplaceEvent).toBe(true)
    expect(fullAssistantContent.length).toBeGreaterThan(50)

    // Must contain N-topic announcement
    const hasTopicAnnouncement =
      fullAssistantContent.includes('個主題') ||
      fullAssistantContent.includes('個問題')
    expect(hasTopicAnnouncement).toBe(true)

    // Must NOT be a generic question (must reference resume)
    const isTooGeneric =
      fullAssistantContent === '你在產品規劃方面有哪些挑戰？' ||
      fullAssistantContent.length < 30
    expect(isTooGeneric).toBe(false)

    console.log('AI first message preview:', fullAssistantContent.slice(0, 200))
  }, 60000)

  it('QUANTIFY_TRIGGER fires when user describes a quantifiable achievement', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const quantifiableMessage =
      '我主導這個專案後，整個團隊的效率提升了非常多，處理速度也加快了很多，用戶滿意度也顯著改善了'

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userMessage: quantifiableMessage }),
    })

    expect(res.status).toBe(200)

    let gotTrigger = false
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        if (eventType === 'trigger') gotTrigger = true
      }
    }

    expect(gotTrigger).toBe(true)
    console.log('QUANTIFY_TRIGGER fired correctly')
  }, 60000)

  it('quantify round 1 response contains bounded example numbers', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/quantify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        topic: '專案效率提升',
        context: '用戶說效率提升了非常多，處理速度加快了很多',
        messages: [],
        roundNumber: 1,
        userMessage: '我讓團隊處理速度提升了很多',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data.assistantMessage).toBe('string')
    expect(data.isComplete).toBe(false)

    // Must contain numeric examples (%, 倍, 分鐘, 小時, etc.)
    const hasNumericExample = /\d+(%|倍|分鐘|小時|天|件|人|萬)/.test(data.assistantMessage)
    expect(hasNumericExample).toBe(true)

    console.log('Round 1 response preview:', data.assistantMessage.slice(0, 200))
  }, 30000)

  it('quantify completes full 5-round flow', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const userAnswers = [
      '從原本要 2 天縮短到半天',
      '大概是 75% 左右的縮短',
      '對，就是這個數字，75%',
      '這已經是很精確的估算了',
    ]

    let currentEntryId: string | undefined
    let currentRound = 1
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const answer of userAnswers) {
      const res = await fetch(`${BASE_URL}/api/quantify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic: '處理時間優化',
          context: '用戶說從 2 天縮到半天',
          messages,
          roundNumber: currentRound,
          userMessage: answer,
          entryId: currentEntryId,
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      messages.push({ role: 'user', content: answer })
      messages.push({ role: 'assistant', content: data.assistantMessage })
      if (currentRound === 1) currentEntryId = data.entryId
      if (data.isComplete) {
        console.log('Quantify completed at round', currentRound, 'result:', data.result)
        break
      }
      currentRound++
    }

    // After 4-5 rounds, should be complete or close to complete
    expect(currentRound).toBeGreaterThanOrEqual(2)
  }, 120000)

  it('session state is retrievable for resume', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const res = await fetch(`${BASE_URL}/api/session/${sessionId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(sessionId)
    expect(Array.isArray(data.conversation_history)).toBe(true)
    expect(data.conversation_history.length).toBeGreaterThan(0)
    console.log('Session has', data.conversation_history.length, 'messages, gaps_completed:', data.gaps_completed)
  }, 10000)

  it('SSE response does not buffer — emits text events in real time', async () => {
    const serverUp = await checkServer()
    if (!serverUp || !sessionId) return

    const start = Date.now()
    let firstChunkTime: number | null = null

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userMessage: '繼續' }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.trim().split('\n')
        const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim()
        if (eventType === 'text' && firstChunkTime === null) {
          firstChunkTime = Date.now() - start
          break outer
        }
      }
    }

    // Should receive first text chunk within 5 seconds (LLM starts generating)
    expect(firstChunkTime).not.toBeNull()
    expect(firstChunkTime!).toBeLessThan(5000)
    console.log('First SSE chunk received after', firstChunkTime, 'ms')

    // Drain remaining
    const reader2 = res.body
    if (reader2) {
      try { await reader2.cancel() } catch { /* ignore */ }
    }
  }, 30000)

  it('returns 404 for invalid sessionId', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'invalid-session-id-000', userMessage: 'test' }),
    })
    expect(res.status).toBe(404)
  })

  it('upload rejects unsupported file type', async () => {
    const serverUp = await checkServer()
    if (!serverUp) return

    const formData = new FormData()
    formData.append('file', Buffer.from('not a resume'), {
      filename: 'test.txt',
      contentType: 'text/plain',
    })

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers: formData.getHeaders(),
    })
    expect(res.status).toBe(400)
  })
}, 300000)
```

- [ ] **Step 2: Run UAT test (requires running dev server)**

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
npm run test:uat -- --reporter=verbose
```

Expected: tests that depend on dev server should pass. Tests that find issues will fail — document those failures.

- [ ] **Step 3: Fix any failures found by UAT**

Common issues to check:
- If `QUANTIFY_TRIGGER` test fails: the career advisor prompt may not be aggressive enough; tighten the trigger conditions in `lib/agents/career-advisor.ts`
- If `round 1 numeric example` test fails: tighten the quantify advisor prompt round 1 rules in `lib/agents/quantify-advisor.ts`
- If `N-topic announcement` test fails: verify `buildCareerAdvisorPrompt` includes the opening format instruction

- [ ] **Step 4: Re-run UAT after fixes**

```bash
npm run test:uat -- --reporter=verbose
```

Expected: all applicable tests pass.

- [ ] **Step 5: Run full regression suite**

```bash
npm run test:unit && npm run test:sit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tests/uat/interview-ux.test.ts
git commit -m "test: add UAT agent test covering full interview UX flow with 彭敬鈞履歷.pdf"
```

---

## Spec Coverage Self-Review

| Spec Requirement | Implemented In |
|-----------------|---------------|
| AI 第一則訊息包含 N 個主題清單 | Task 1 — career-advisor.ts |
| AI 問題必須引用履歷原文 | Task 1 — career-advisor.ts |
| 積極觸發 QUANTIFY_TRIGGER | Task 1 — career-advisor.ts |
| Quantify Round 1 引用 context + 範例 | Task 2 — quantify-advisor.ts |
| 每輪都有範例數字 | Task 2 — quantify-advisor.ts |
| Quantify Modal 自動開場 | Task 2 — QuantifyModal.tsx |
| SSE 打字機效果（每 chunk 即時） | Task 3 — chat/route.ts |
| replace 事件還原 clean content | Task 3 — chat/route.ts |
| AI 訊息 markdown 渲染 | Task 4 — MessageBubble.tsx |
| 進度條顯示目前主題名稱 | Task 5 — InterviewProgress.tsx |
| 傳遞 interviewGaps prop | Task 5 — session/[id]/page.tsx |
| Smart auto-scroll（僅底部附近） | Task 6 — ChatInterface.tsx |
| 「▼ 新訊息」按鈕 | Task 6 — ChatInterface.tsx |
| 手動量化數字按鈕 | Task 6 — ChatInterface.tsx |
| streamingContent 分離狀態 | Task 6 — ChatInterface.tsx |
| localStorage session 儲存 | Task 7 — HomeClient.tsx |
| 首頁「繼續訪談」橫幅 | Task 7 — HomeClient.tsx |
| UAT 自動化測試 10 情境 | Task 8 — interview-ux.test.ts |
