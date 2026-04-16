# Task 8：前端上傳頁面設計

## 概述

建立首頁的三步驟 wizard，引導用戶完成：上傳履歷 → 選擇目標職位 → 選擇年資等級，最終建立 session 並跳轉至訪談頁面。

## 架構

採用 Server Component + Client 子元件模式：
- `app/page.tsx`（Server Component）：在 server 端載入 persona career 列表，傳給 client 子元件
- `components/wizard/HomeClient.tsx`（Client Component）：管理 wizard state、步驟切換、API 呼叫

原因：`lib/persona/templates.ts` 使用 `fs.readdirSync`（server-only），無法在 client component 直接呼叫。

## Wizard 流程

### Step 1：上傳履歷
- 拖曳或點擊上傳 PDF/DOCX
- 呼叫 `POST /api/upload`，解析檔案並用 LLM（gpt-4o-mini）驗證是否為履歷
- 非履歷內容（成績單、論文等）立即回傳 422 錯誤，顯示中文提示
- 驗證通過後取得 `markdown`
- 自動呼叫 `POST /api/persona`，取得 AI 推薦的 3 個 career 類別
- 上傳完成後自動進入 Step 2

### Step 2：選擇目標職位
- 所有職位顯示**繁體中文職稱**（取自 mid-level 模板的 title）
- 顯示 AI 推薦的 3 個職位類別（中文職稱 + reason），每個都標記「AI 推薦」
- **Hover 說明**：滑鼠移到任何職位卡片上，顯示浮動提示框描述該職位工作內容（取自 mid-level 模板 responsibilities 前 2 項）
- 下方有「查看全部職位」按鈕，點擊展開完整 18 個 career 列表（排除已推薦的）
- 非推薦的卡片不顯示「AI 推薦」標記和 reason
- 用戶點選一個職位，按「下一步」進入 Step 3

### Step 3：選擇年資等級
- 顯示已選職位名稱作為副標題
- 橫排三張卡片：Junior（0-2 年）、Mid-level（3-5 年）、Senior（6+ 年）
- 用戶選一個，按「開始訪談」
- 前端組合 `${career}-${level}` 作為 persona ID（如 `product-manager-mid`）
- 呼叫 `POST /api/session` 建立 session → 跳轉 `/session/[id]`

## 進度條

頂部三步驟圓形指示器，貫穿所有步驟：
- 完成的步驟：綠色圓圈 + 勾號，連接線為綠色
- 當前步驟：藍色（primary）圓圈 + 數字
- 未到步驟：淺灰圓圈 + 數字，連接線為淺灰
- 標籤：「上傳履歷」「選擇職位」「選擇年資」

## 元件結構

### 新建檔案

| 檔案 | 職責 |
|------|------|
| `components/wizard/ProgressBar.tsx` | 進度條元件，接收 `currentStep` prop（1/2/3） |
| `components/wizard/HomeClient.tsx` | Client 端 wizard 主邏輯，管理 step state 和 API 呼叫 |
| `components/upload/FileUpload.tsx` | 拖曳/點擊上傳區塊，呼叫 `/api/upload` |
| `components/persona/PersonaCard.tsx` | 職位卡片（推薦的顯示 AI 標記 + reason，非推薦的只顯示名稱） |
| `components/persona/LevelCard.tsx` | 年資等級卡片（名稱 + 年資範圍） |

### 修改檔案

| 檔案 | 變更 |
|------|------|
| `app/page.tsx` | 改為 Server Component，載入 career 列表傳給 HomeClient |
| `lib/persona/templates.ts` | 新增 `getCareerList()` 函數，萃取 18 個不重複 career 類別 |
| `app/api/persona/route.ts` | 改為推薦 career 類別（如 `product-manager`）而非具體模板 ID（如 `product-manager-mid`） |

## 資料流

```
page.tsx (server)
  └─ getCareerList() → careers: { id: string, title: string }[]
  └─ <HomeClient careers={careers} />

HomeClient (client)
  state: step (1|2|3), resumeMarkdown, recommendations, selectedCareer, selectedLevel

  Step 1: FileUpload
    → POST /api/upload → markdown
    → POST /api/persona { resumeMarkdown } → recommendations: { career: string, reason: string }[]
    → setStep(2)

  Step 2: PersonaCard × 3 (推薦) + 「查看全部職位」展開剩餘 careers
    → setSelectedCareer(career)
    → 按「下一步」→ setStep(3)

  Step 3: LevelCard × 3
    → setSelectedLevel(level)
    → 按「開始訪談」
    → POST /api/session { resumeMarkdown, personaId: `${career}-${level}` }
    → router.push(`/session/${id}`)
```

## Persona API 變更

現行：推薦具體模板 ID（如 `product-manager-mid`），prompt 包含全部 54 個模板。

變更後：推薦 career 類別（如 `product-manager`），prompt 只包含 18 個不重複 career。回傳格式：

```json
{
  "recommendations": [
    { "career": "product-manager", "title": "Product Manager", "reason": "..." },
    { "career": "software-engineer", "title": "Software Engineer", "reason": "..." }
  ]
}
```

## templates.ts 新增函數

```typescript
export interface CareerInfo {
  id: string          // e.g. "product-manager"
  title: string       // e.g. "產品經理"（取自 mid 模板）
  description: string // e.g. "定義產品需求並撰寫規格文件、協調跨部門資源推動產品開發與上線"
}

export function getCareerList(): CareerInfo[]
```

從 54 個模板中，以 mid-level 模板為基準：title 取 mid 模板的 title（避免 junior 帶「專員」、senior 帶「資深」差異），description 取 mid 模板 responsibilities 前 2 項用頓號連接。

## 設計系統

遵循 CLAUDE.md 定義的設計系統：
- Primary: `#0369A1`、Secondary: `#0EA5E9`、CTA: `#22C55E`、Surface: `#F0F9FF`、Ink: `#0C4A6E`
- Font: Inter（已在 layout.tsx 設定）
- Icons: Lucide React
- 互動：`cursor-pointer` + `transition-colors duration-200`
- 版型：max-w-2xl mx-auto，居中單欄

## 錯誤處理

- 上傳失敗：在上傳區塊下方顯示紅色錯誤訊息
- Persona API 失敗：仍進入 Step 2，但不顯示推薦標記（用戶可以從列表中選）
- Session 建立失敗：在按鈕下方顯示錯誤訊息

## 不在範圍內

- 搜尋或篩選 persona 功能
- 返回上一步功能（簡化 MVP，可後續加）
- 響應式設計細節（先聚焦桌面版）
