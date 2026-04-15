# AI 履歷優化器 - 開發進度

## 專案位置
`C:/side/Resume_Optimizer/resume-optimizer/`

## 實作計畫
完整計畫在：`C:\Users\albertpeng\.claude\plans\refactored-splashing-hopcroft.md`

## 技術棧（重要差異）
- **Next.js 16**（非 14），App Router
- **Tailwind v4**（非 v3）：顏色用 `@theme` 在 `app/globals.css` 設定，**沒有 `tailwind.config.ts`**
- **Dynamic route params** 必須 await：`const { id } = await params`
- **pdf-parse v2**：使用 `new PDFParse({ data })` class API，非 v1 的函數 API
- **supabase**：`createServerClient()` 用於 server routes，`getSupabaseClient()` 用於 client（無 named `supabase` export）

## 設計系統
```
primary:   #0369A1
secondary: #0EA5E9
cta:       #22C55E
surface:   #F0F9FF
ink:       #0C4A6E
font:      Inter (via next/font/google, variable: --font-inter)
icons:     Lucide React（禁用 emoji）
```

## 環境變數（.env.local 已設定）
- OPENAI_API_KEY ✅
- NEXT_PUBLIC_SUPABASE_URL=https://mqpelxjwzlfrwycyouwz.supabase.co ✅
- NEXT_PUBLIC_SUPABASE_ANON_KEY ✅
- SUPABASE_SERVICE_ROLE_KEY ✅

## Supabase
- 專案 URL：https://mqpelxjwzlfrwycyouwz.supabase.co
- `sessions` 資料表已建立，RLS 開啟（allow all policy）
- Schema：id, created_at, updated_at, resume_markdown, persona_id, conversation_history(jsonb), collected_context(jsonb), interview_gaps(jsonb), gaps_completed(int), gaps_total(int), docx_content(text), status('in_progress'|'completed')

## 測試指令
```bash
npm run test:sit    # SIT 整合測試（需要 Supabase 連線）
npm run test:unit   # 單元測試（不需網路）
npm run test:uat    # UAT 測試（需要 dev server）
npm run dev         # 啟動開發伺服器 localhost:3000
```

## Persona 資料
- 模板已從模擬 104 JD 資料蒸餾（各 15 份，scraper 已備妥待 104 解封）
- 真實爬蟲：`scripts/scrape-104.ts`
- 蒸餾腳本：`scripts/distill-personas.ts`
- 原始資料在 `scripts/jd-data/`（gitignored）

---

## 已完成 Tasks（✅）

| Task | 內容 | Commit |
|------|------|--------|
| Task 0 | Next.js 初始化、Tailwind v4、Inter 字體、vitest 設定 | `d2b4302` + `1b482c5` |
| Task 1 | Supabase client（lazy init）、sessions CRUD 測試 | `88c14f6` + `0f230f4` |
| Task 2 | 3 個 Persona 模板 JSON + templates.ts | `c0a040d` |
| Task 3 | PDF/DOCX 解析器 + 上傳 API | `e0cff6b` |
| Task 6 | Session CRUD API routes | `63a5ff0` |
| Persona | 104 JD 蒸餾更新 Persona 模板（mock data）| `28f3321` |

---

## 待完成 Tasks（⏳）

### Task 4：Persona 推薦 API
- 建立 `app/api/persona/route.ts`
- POST 接收 resumeMarkdown → OpenAI 呼叫 → 回傳 2-3 個推薦 Persona
- 建立 `tests/sit/persona.test.ts`
- 詳見計畫檔 Task 4 完整程式碼

### Task 5：Career Advisor Chat API（Streaming）
- 建立 `lib/agents/career-advisor.ts`（system prompt builder + gap status 解析）
- 建立 `app/api/chat/route.ts`（streaming，讀 session → 組 messages → stream）
- 建立 `tests/sit/chat.test.ts`
- **關鍵**：streaming 用 `ReadableStream`，gap tracking 用 `[GAPS_STATUS]: {...}` 隱藏行

### Task 7：Mapping Agent + DOCX 生成
- 建立 `lib/agents/mapping-agent.ts`（OpenAI 呼叫，STAR 框架重寫）
- 建立 `lib/docx-generator.ts`（用 `docx` npm 套件）
- 建立 `app/api/map/route.ts`（呼叫 mapping agent → 生成 DOCX → 存 base64 到 Supabase）
- 建立 `app/api/download/[id]/route.ts`（讀 base64 → 回傳 DOCX）
- 建立 `tests/sit/docx.test.ts`

### Task 8：前端 - 上傳頁面
- `components/upload/FileUpload.tsx`
- `components/persona/PersonaCard.tsx`
- `app/page.tsx`（三步驟：上傳 → Persona 選擇 → 建立 session → 跳轉）

### Task 9：前端 - 訪談介面（含進度條）
- `components/chat/InterviewProgress.tsx`（進度條 + 鼓勵文案）
- `components/chat/MessageBubble.tsx`
- `components/chat/ChatInterface.tsx`（streaming）
- `app/session/[id]/page.tsx`
- **鼓勵文案**：依進度 0/25/50/75/100% 切換

### Task 10：前端 - 結果頁面
- `components/result/ResumePreview.tsx`
- `app/result/[id]/page.tsx`

### Task 11：SIT Agent 設定
- `.claude/agents/sit-agent.md`
- `app/api/health/route.ts`（health check）

### Task 12：UAT Agent + 邊緣案例生成器
- `.claude/agents/uat-agent.md`
- `tests/uat/happy-path.test.ts`
- `tests/uat/edge-case-generator.ts`

### Task 13：完整流程驗證

---

## 開發執行方式
使用 `superpowers:subagent-driven-development`：
1. 每個 Task 派發 implementer subagent
2. spec reviewer 審查
3. code quality reviewer 審查
4. 修正後才進入下一個 Task

## 注意事項
- Tasks 4、5、7 是後端核心，順序依賴：先 4 才能測試 persona 推薦，先 5 才能測試訪談
- Tasks 8、9、10 是前端，依賴所有後端 API 完成
- 104 scraper 目前被 bot protection 擋住，Persona 使用 mock 資料蒸餾版本
