# 訪談體驗強化設計規格

**日期：** 2026-04-17  
**狀態：** 已核准  

---

## 背景與動機

目前訪談顧問的痛點：
1. 問題缺乏引導性，AI 問的問題沒有根據履歷內容
2. 量化顧問（QuantifyModal）幾乎不會被觸發
3. 訊息沒有打字機效果，SSE chunks 沒有即時渲染
4. 每次都要手動捲到底才能看到最新訊息
5. AI 回答以純文字顯示，markdown 沒有渲染
6. 使用者中途離開後不清楚如何回到同一個 session

---

## 設計範圍

### 1. Career Advisor 系統提示重構

**檔案：** `lib/agents/career-advisor.ts`

#### 1a. 第一則訊息強制格式

`buildCareerAdvisorPrompt()` 的 system prompt 必須要求 AI 開場白包含：

```
你好！我已仔細閱讀你的履歷了。我找到了 {N} 個主題想深入了解，
以幫你打造更有說服力的[目標職位]履歷：

1. [topic 1]
2. [topic 2]
...N. [topic N]

我們先從第 1/{N} 個主題開始：[topic 1 名稱]

[針對履歷原文的具體問題——必須直接引用履歷中的段落或成就]
```

N 的數值來自 `persona.interview_gaps.length`，須在 prompt 中代入。

#### 1b. System Prompt 新規則（追加到現有規則後）

```
## 訪談規則

1. 按照上方主題清單逐一進行，每次只討論一個主題
2. 每個問題必須引用履歷原文（禁止泛問「你遇過什麼挑戰？」）
3. 遇到以下情況必須在回應末尾加上 [QUANTIFY_TRIGGER]：
   - 使用者提到時間節省（「減少了很多」「快很多」）
   - 使用者提到規模（「很多用戶」「一個大團隊」）
   - 使用者提到改善幅度（「效率提升」「成本降低」）
   - 使用者描述任何可以用數字表達的成就
4. 一個主題討論完畢後，明確說「好，這個主題我了解了，我們進入第 X/{N} 個主題：[名稱]」
   並同步更新 [GAPS_STATUS]
5. 每次只問一個問題
```

---

### 2. Quantify Advisor 系統提示強化

**檔案：** `lib/agents/quantify-advisor.ts`

#### 2a. Round 1 強制格式

在 `buildQuantifyAdvisorPrompt()` 中加入規則：

```
## Round 1 開場規則
第 1 輪必須做到：
1. 直接引用 context 中使用者說的具體內容
2. 給出兩個有界的範例答案供使用者參考（一個偏小、一個偏大）
3. 問一個選擇題，不問開放式問題

範例格式：
「你提到[context 原文]。我想幫你找出一個具體數字。
例如，可能是『從原本的 2 小時縮短到 20 分鐘（減少約 83%）』，
或者是比較小的改變，像是『從 30 分鐘縮到 20 分鐘（減少約 33%）』。
你覺得比較接近哪一種情況？」
```

#### 2b. 每輪都提供範例

追加規則：
```
## 範例引導規則
每一輪的問題都必須附上至少一個具體範例答案，
讓使用者知道「這種答案是可被接受的」。
例如：「大概是 10% 這樣的量級，還是更多，像 30%？」
禁止只問「大概是多少？」這類完全開放的問題。
```

---

### 3. Chat UI 改善

**檔案：** `components/chat/ChatInterface.tsx`

#### 3a. 打字機效果（SSE 即時渲染）

```
狀態設計：
- messages: Message[]         // 已完成的訊息
- streamingContent: string    // 正在串流中的文字（chunk 累積）
- isStreaming: boolean

串流邏輯：
- 收到 event: text → streamingContent += chunk（立即 setState）
- 收到 event: done → 
    messages.push({ role: 'assistant', content: streamingContent })
    streamingContent = ''
    isStreaming = false

UI 渲染：
- 顯示 messages（歷史）
- 若 isStreaming，在最後加一條灰色氣泡顯示 streamingContent + 游標動畫
```

#### 3b. Auto-Scroll

```
規則：
- 每次 streamingContent 更新 → 若使用者距底部 < 150px → scrollToBottom()
- 使用者向上捲動超過 150px → 停止自動捲動 + 顯示「▼ 新訊息」浮動按鈕
- 點擊「▼ 新訊息」按鈕 → scrollToBottom() + 隱藏按鈕

實作：
- useRef(messagesEndRef) 指向列表底部的空 div
- useRef(containerRef) 指向捲動容器
- onScroll handler 更新 isUserScrolledUp state
```

#### 3c. 手動觸發量化按鈕

在輸入框左側加一個常駐按鈕：
- 圖示：`<PlusCircle />` + 文字「量化數字」
- 點擊後彈出 QuantifyModal，topic 預設為目前主題名稱，context 為空（使用者填入）
- 按鈕顏色：`text-secondary`，hover 變 `text-primary`

#### 3d. Session 續接（localStorage）

```typescript
// 建立 session 後
localStorage.setItem('lastSessionId', sessionId)
localStorage.setItem('lastSessionStatus', 'in_progress')

// 首頁載入時（HomeClient.tsx）
const lastSessionId = localStorage.getItem('lastSessionId')
const lastStatus = localStorage.getItem('lastSessionStatus')
if (lastSessionId && lastStatus === 'in_progress') {
  // 顯示「繼續上次訪談」橫幅
  // 點擊 → router.push(`/session/${lastSessionId}`)
}

// session 完成時清除
localStorage.removeItem('lastSessionId')
```

---

### 4. MessageBubble Markdown 渲染

**檔案：** `components/chat/MessageBubble.tsx`  
**新增依賴：** `react-markdown`

```
- 安裝：npm install react-markdown
- AI 訊息（role === 'assistant'）：使用 <ReactMarkdown> 渲染
- 使用者訊息（role === 'user'）：維持純文字 <p>
- 串流中的訊息也使用 ReactMarkdown（支援不完整 markdown）
```

---

### 5. 進度條顯示目前主題名稱

**檔案：** `components/chat/InterviewProgress.tsx`

```
新設計：
┌─────────────────────────────────────────────┐
│  目標：產品經理        主題 2/8：跨部門協作    │
│  ████████░░░░░░░░░░░░░░░░  25%               │
│  「你提到的這段經歷很關鍵，繼續聊！」          │
└─────────────────────────────────────────────┘

新增 prop: currentTopicName?: string
從 ChatInterface 解析 GAPS_STATUS 中的當前主題名稱傳入
```

---

### 6. UAT Agent 自動化測試

所有改動完成後，派一個 UAT Agent 對 localhost:3000 進行嚴苛的自動化測試，素材使用 `彭敬鈞履歷.pdf`。

**UAT Agent 職責：**
- 透過 API 呼叫模擬完整使用者流程
- 針對每個改動點驗證行為是否符合規格
- 回報所有發現的問題，實作 subagent 依回饋進行修正
- 修正後 UAT Agent 再次執行驗證（循環直到通過）

**測試情境（嚴苛）：**

| 情境 | 驗證重點 |
|------|---------|
| 正常流程 | 上傳 PDF → persona 推薦 → 建立 session → 訪談 → 量化 → 生成履歷 → 下載 DOCX |
| AI 首訊格式 | 第一則訊息必須包含「N 個主題清單」且 N 符合 persona.interview_gaps 數量 |
| 問題引導性 | AI 問題必須引用履歷原文，不得泛問（用 GPT 評分判斷） |
| QUANTIFY_TRIGGER | 給出含有可量化成就的回答後，response 中必須出現 [QUANTIFY_TRIGGER] |
| 量化 Round 1 | 第一輪問題必須包含具體範例數字（如「83%」或「20 分鐘」） |
| 量化完整 5 輪 | 模擬完整 5 輪對話，確認 [QUANTIFY_RESULT] 或 [QUANTIFY_FAILED] 正確輸出 |
| Session 續接 | 中途離開再透過 sessionId 重新進入，確認歷史訊息完整 |
| SSE 串流格式 | 確認 chat API 回應為 SSE 格式，每個 chunk 獨立傳送（非 buffer） |
| Mapping + DOCX | 完成訪談後呼叫 /api/map，確認 DOCX 可下載且格式正確 |
| 錯誤情境 | 無效 sessionId、空白履歷、不支援的文件格式 → 確認正確 4xx 回應 |

---

## 改動清單

| 檔案 | 改動類型 | 說明 |
|------|---------|------|
| `lib/agents/career-advisor.ts` | 修改 | 重構 system prompt：結構化主題、強制首訊格式、積極 QUANTIFY_TRIGGER |
| `lib/agents/quantify-advisor.ts` | 修改 | Round 1 強制格式 + 每輪提供範例答案 |
| `app/api/chat/route.ts` | 確認/修正 | 確保 SSE 不 buffer，每個 chunk 即時傳出 |
| `components/chat/ChatInterface.tsx` | 修改 | 打字機效果、auto-scroll、localStorage session 續接、手動量化按鈕 |
| `components/chat/MessageBubble.tsx` | 修改 | 加入 react-markdown 渲染 AI 訊息 |
| `components/chat/InterviewProgress.tsx` | 修改 | 顯示目前主題名稱 |
| `components/wizard/HomeClient.tsx` | 修改 | 讀取 localStorage，顯示「繼續上次訪談」 |
| `tests/uat/` | 新增 | UAT 測試，素材用 彭敬鈞履歷.pdf |

---

## 驗證方式

```bash
# 1. 跑現有測試確認沒有 regression
npm run test:unit
npm run test:sit

# 2. 啟動開發伺服器
npm run dev

# 3. 派 UAT Agent 執行自動化測試（用彭敬鈞履歷.pdf）
# UAT Agent 呼叫 localhost:3000 API，執行上方 10 個測試情境
# 回報所有問題 → 實作 subagent 修正 → UAT Agent 再次驗證
# 循環直到所有情境通過
```
