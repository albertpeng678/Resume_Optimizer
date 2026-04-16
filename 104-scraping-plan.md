# 104 職缺爬取計畫｜Persona 蒸餾素材

## 規模

18 個職業 × 3 個層級 × 10 筆 = **540 筆職缺**
蒸餾產出：**54 個 Persona**

---

## 目標職業清單

| # | 職業 | 104 搜尋關鍵字 |
|---|------|--------------|
| 1 | 產品經理 Product Manager | 產品經理, Product Manager |
| 2 | 專案經理 Project Manager | 專案經理, Project Manager |
| 3 | 軟體工程師 Software Engineer | 軟體工程師, Software Engineer |
| 4 | 數據分析師 Data Analyst | 數據分析師, Data Analyst |
| 5 | 商務開發 Business Development | 商務開發, Business Development |
| 6 | 行銷 Marketing | 行銷企劃, Marketing |
| 7 | UI/UX 設計師 | UI設計師, UX設計師, UI/UX |
| 8 | 資料工程師 Data Engineer | 資料工程師, Data Engineer |
| 9 | 技術專案經理 / Scrum Master | Scrum Master, 技術專案經理 |
| 10 | 客戶成功 Customer Success | 客戶成功, Customer Success |
| 11 | 資安工程師 Security Engineer | 資安工程師, 資訊安全 |
| 12 | 機器學習工程師 ML Engineer | 機器學習工程師, ML Engineer |
| 13 | 解決方案架構師 Solutions Architect | 解決方案架構師, Solutions Architect |
| 14 | 產品行銷 Product Marketing Manager | 產品行銷, Product Marketing |
| 15 | 技術客服 Technical Support | 技術支援, Technical Support |
| 16 | DevOps / SRE | DevOps, SRE, Site Reliability |
| 17 | 內容行銷 Content Marketing | 內容行銷, Content Marketing |
| 18 | 電商營運 E-commerce Operations | 電商營運, 電商運營 |

---

## 年資層級對照

104 用工作年資篩選，對應關係如下：

| Persona 層級 | 104 年資參數 | exp 值 |
|-------------|------------|--------|
| Junior | 1年以下 / 1-3年 | `exp=1` 或 `exp=2` |
| Mid-level | 3-5年 | `exp=3` |
| Senior | 5-10年 | `exp=4` |

---

## 代表性職缺篩選條件

每個職業 × 層級組合，先爬超過 10 筆，再用以下條件過濾，取前 10 筆：

**第一層過濾（搜尋列表階段）**
- `applyCnt` 應徵人數 > 30
- `employees` 公司員工數 > 50
- 職缺更新日期 < 30 天內

**第二層過濾（進入職缺詳細頁後）**
- `jobContent` 職缺描述字數 > 300 字
- 有明確技能要求（`condition.specialty` 非空）

---

## API 爬取架構

### Step 1｜搜尋列表

```
GET https://www.104.com.tw/jobs/search/list
Headers:
  Referer: https://www.104.com.tw/jobs/search/

Params:
  keyword: {職業關鍵字}
  exp: {年資層級}
  order: 1          # 依符合度排序
  asc: 0
  page: 1~N
  mode: s
  jobsource: 2018indexpoc
```

回傳欄位取用：
- `jobNo`：職缺 ID
- `applyCnt`：應徵人數
- `appearDate`：更新日期
- `employees`：公司員工數
- `isPublicCompany`：是否上市櫃
- `custName`：公司名稱

### Step 2｜職缺詳細頁（僅對通過第一層過濾的職缺發請求）

```
GET https://www.104.com.tw/job/ajax/content/{jobNo}
Headers:
  Referer: https://www.104.com.tw/job/{jobNo}
```

回傳欄位取用：
- `jobContent`：職缺描述全文
- `condition.specialty`：技能要求
- `condition.edu`：學歷要求
- `condition.exp`：經歷要求
- `condition.language`：語文條件

---

## 輸出格式

每筆職缺存成 JSON：

```json
{
  "meta": {
    "job_id": "abc123",
    "title": "產品經理",
    "company": "某科技公司",
    "employees": 500,
    "is_public": true,
    "apply_cnt": 87,
    "appear_date": "2026-04-10",
    "persona_level": "mid"
  },
  "jd": {
    "content": "職缺描述全文...",
    "specialty": ["SQL", "Python", "Tableau"],
    "edu": "大學",
    "exp": "3-5年",
    "language": []
  }
}
```

存檔結構：

```
/data
  /product_manager
    /junior
      job_001.json
      job_002.json
      ...（共 10 筆）
    /mid
      ...
    /senior
      ...
  /project_manager
    ...
```

---

## 爬取順序建議

每個職業跑完再跑下一個，避免觸發反爬限制：
- 每次請求間隔 1-2 秒
- 每個職業爬完休息 5 秒
- User-Agent 帶正常瀏覽器字串

預估總爬取時間：約 540 筆詳細頁 × 2 秒 + 緩衝 ≈ **30-40 分鐘**

---

## 給 Claude Code Agent 的開場說明

```
我要爬取 104 人力銀行的職缺資料，作為 Persona 蒸餾素材。

目標：18 個職業 × 3 個層級（junior/mid/senior）× 各 10 筆 = 540 筆

請先用計畫模式，不要寫任何程式碼。
規劃爬取腳本的架構，並列出所有需要確認的技術決策。

特別注意：
1. 需要帶 Referer header 才能正常取得資料
2. 分兩階段爬取：先搜尋列表做第一層過濾，再進職缺詳細頁
3. 每筆輸出為獨立 JSON 檔，存放在對應職業/層級資料夾
4. 請求間隔 1-2 秒，避免觸發反爬
```
