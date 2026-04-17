import { PersonaTemplate } from '@/lib/persona/templates'

const GAP_LABELS: Record<string, string> = {
  accessibility: '無障礙設計',
  agile_methodology: '敏捷開發方法',
  architecture_decisions: '架構決策',
  audience_analysis: '受眾分析',
  automation: '自動化',
  brand_management: '品牌管理',
  budget_management: '預算管理',
  business_insight: '商業洞察',
  campaign_strategy: '行銷活動策略',
  client_communication: '客戶溝通',
  client_relationship: '客戶關係',
  client_retention: '客戶留存',
  competitive_analysis: '競品分析',
  compliance: '合規管理',
  conflict_resolution: '衝突解決',
  content_strategy: '內容策略',
  conversion_optimization: '轉換優化',
  cross_functional_collab: '跨職能協作',
  cross_team_collaboration: '跨團隊協作',
  customer_advocacy: '客戶倡議',
  customer_communication: '客戶溝通',
  data_analysis: '數據分析',
  data_modeling: '數據建模',
  data_pipeline: '資料管線',
  data_quality: '數據品質',
  data_storytelling: '數據敘事',
  design_process: '設計流程',
  design_systems: '設計系統',
  editorial_planning: '編輯規劃',
  escalation_process: '升級流程',
  experiment_design: '實驗設計',
  go_to_market: '上市策略',
  incident_management: '事件管理',
  incident_response: '事件應變',
  infrastructure_design: '基礎架構設計',
  integration_strategy: '整合策略',
  knowledge_management: '知識管理',
  launch_execution: '產品上線執行',
  leadership_experience: '領導力',
  market_analysis: '市場分析',
  market_research: '市場研究',
  messaging_strategy: '訊息策略',
  methodology: '工作方法',
  model_deployment: '模型部署',
  model_development: '模型開發',
  monitoring_strategy: '監控策略',
  negotiation: '談判技巧',
  onboarding_process: '新人導入流程',
  operations_optimization: '營運優化',
  partnership_strategy: '合作夥伴策略',
  performance_impact: '績效影響',
  pipeline_architecture: '管線架構',
  platform_management: '平台管理',
  process_improvement: '流程改善',
  product_planning: '產品規劃',
  project_scale: '專案規模與影響',
  quantified_outcomes: '量化成果',
  resource_planning: '資源規劃',
  revenue_impact: '營收影響',
  risk_management: '風險管理',
  scalability: '系統可擴展性',
  security_architecture: '安全架構',
  seo_optimization: 'SEO 優化',
  solution_design: '解決方案設計',
  stakeholder_management: '利害關係人管理',
  statistical_analysis: '統計分析',
  supply_chain: '供應鏈管理',
  system_design: '系統設計',
  team_facilitation: '團隊引導',
  team_mentoring: '團隊培育',
  technical_background: '技術背景',
  technical_complexity: '技術複雜度',
  technical_consulting: '技術諮詢',
  technical_leadership: '技術領導力',
  threat_modeling: '威脅建模',
  troubleshooting: '問題排除',
  upselling: '向上銷售',
  user_research: '用戶研究',
  user_testing: '用戶測試',
  visualization: '數據視覺化',
}

export function gapLabel(id: string): string {
  return GAP_LABELS[id] ?? id
}

export function buildCareerAdvisorPrompt(
  persona: PersonaTemplate,
  resumeMarkdown: string
): string {
  const n = persona.interview_gaps.length
  const topicList = persona.interview_gaps.map((gap, i) => `${i + 1}. ${gapLabel(gap)}`).join('\n')
  const firstTopicLabel = gapLabel(persona.interview_gaps[0])

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
你的第一則訊息必須分為兩段，中間加上 [SPLIT] 標記，系統會自動拆成兩個對話框顯示：

第一段（主題概覽，簡短友善）：
你好！我已仔細閱讀你的履歷了。我找到了 ${n} 個想深入了解的主題，來幫你打造更有說服力的${persona.title}履歷：

${topicList}

[SPLIT]

第二段（直接開始第一個主題的問題）：
我們先從第 1/${n} 個主題開始：**${firstTopicLabel}**

[這裡是針對履歷原文的具體問題，必須引用原文，並附上 2-3 個選擇題選項]

## 訪談行為規則
1. **按主題順序進行**：逐一討論上方 ${n} 個主題，每次只討論一個
2. **每個問題必須引用履歷原文**：提問時要明確以引號引用履歷裡的具體詞句或段落
   - ✅「你提到「主導了 RAG 知識問答產品的指標體系建置」，這套指標實際跑了多久？影響了哪些決策？」
   - ❌「你在產品規劃方面有哪些挑戰？」（太空泛，沒有引用履歷）
3. **每次只問一個問題，並附上選擇題**：每次提問必須附上 2-3 個選項（A. B. C. 格式，每個選項獨立成行），用戶可選擇一個或自由回答
4. **嚴禁佔位符**：回應中絕對禁止出現任何 [X%]、[數字]、[待補] 等未填入的佔位符
5. **數字量化觸發（積極執行）**：遇到以下任何情況，必須在回應末尾加上 [QUANTIFY_TRIGGER]：
   - 用戶提到時間節省或任何時間長度（「半年」「三個月」「減少了很多」「快很多」）
   - 用戶提到規模（「很多用戶」「大團隊」「大量資料」「幾百人」）
   - 用戶提到改善幅度（「效率提升」「成本降低」「顯著改善」）
   - 用戶描述任何可以用數字表達的成就或影響
   格式：[QUANTIFY_TRIGGER]: {"topic": "主題名稱", "context": "用戶剛描述的成就一句話摘要", "original_text": "履歷中的原文引用", "formula_hint": "time_reduction|scale_impact|cost_savings|percentage_improvement 中最適合的一個"}
6. **主題轉換時使用 [SPLIT]**：當完成一個主題、進入下一個主題時，把「了解了，進入下一個主題」的確認訊息 和「新主題的問題」用 [SPLIT] 分開，例如：
   好的，這個主題我了解了！你提到的 [洞見] 很有參考價值。

   [SPLIT]

   我們進入第 X/${n} 個主題：**[下一個主題中文名]**

   [下一個問題+選項]
7. **3 輪退出機制**：每個 Gap 追問上限 2 次（合計 3 輪）。若第 3 輪用戶仍未給出有效資訊，說「我先記錄這個主題，你之後可以再補充」，並將該主題記入 skipped，移至下一個主題
8. **每輪給即時洞見**：用戶回答後，先給一句有洞見的反饋，再繼續
9. **不提早給優化建議**：你的任務是收集 context，不是現在改履歷
10. **口語化、有溫度**：像和朋友聊天，不像填表單

## 進度追蹤（系統使用）
請在每次回應的最後一行加上：
[GAPS_STATUS]: {"completed": ["已完成的主題名稱"], "skipped": ["跳過的主題名稱"], "current": "當前主題名稱", "current_turns": 已追問當前主題的輪數}
這行內容不會顯示給用戶，純供系統追蹤。`
}

export interface GapStatus {
  completed: string[]
  skipped: string[]
  current: string
  current_turns: number
}

export interface QuantifyTrigger {
  topic: string
  context: string
  original_text: string
  formula_hint: string
}

export function parseQuantifyTrigger(content: string): QuantifyTrigger | null {
  const match = content.match(/\[QUANTIFY_TRIGGER\]:\s*(\{[^\n]+\})/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export function stripQuantifyTrigger(content: string): string {
  return content.replace(/\n?\[QUANTIFY_TRIGGER\]:\s*\{[^\n]+\}/, '')
}

export function parseGapStatus(content: string): GapStatus | null {
  const match = content.match(/\[GAPS_STATUS\]:\s*(\{[\s\S]*?\})\s*$/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    return {
      completed: parsed.completed ?? [],
      skipped: parsed.skipped ?? [],
      current: parsed.current ?? '',
      current_turns: parsed.current_turns ?? 0,
    }
  } catch {
    return null
  }
}

export function stripGapStatus(content: string): string {
  return content.replace(/\n?\[GAPS_STATUS\]:\s*\{[\s\S]*?\}\s*$/, '').trim()
}
