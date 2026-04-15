export interface CareerConfig {
  id: string
  keywords: string[]
  role_zh: string
  interviewGaps: string[]
}

export interface LevelConfig {
  id: string
  exp: string
  years_zh: string
}

export const LEVELS: LevelConfig[] = [
  { id: 'junior', exp: '1,2', years_zh: '1-3年' },
  { id: 'mid', exp: '3', years_zh: '3-5年' },
  { id: 'senior', exp: '4', years_zh: '5-10年' },
]

export const CAREERS: CareerConfig[] = [
  {
    id: 'product-manager',
    keywords: ['產品經理', 'Product Manager'],
    role_zh: '產品經理',
    interviewGaps: [
      'product_planning', 'data_analysis', 'cross_team_collaboration',
      'user_research', 'project_scale', 'technical_background',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'project-manager',
    keywords: ['專案經理', 'Project Manager'],
    role_zh: '專案經理',
    interviewGaps: [
      'risk_management', 'stakeholder_management', 'resource_planning',
      'methodology', 'project_scale', 'cross_team_collaboration',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'software-engineer',
    keywords: ['軟體工程師', 'Software Engineer'],
    role_zh: '軟體工程師',
    interviewGaps: [
      'system_design', 'technical_complexity', 'performance_impact',
      'team_mentoring', 'architecture_decisions', 'cross_functional_collab',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'data-analyst',
    keywords: ['數據分析師', 'Data Analyst'],
    role_zh: '數據分析師',
    interviewGaps: [
      'data_modeling', 'statistical_analysis', 'business_insight',
      'visualization', 'data_storytelling', 'cross_team_collaboration',
      'quantified_outcomes', 'project_scale',
    ],
  },
  {
    id: 'business-development',
    keywords: ['商務開發', 'Business Development'],
    role_zh: '商務開發',
    interviewGaps: [
      'revenue_impact', 'partnership_strategy', 'market_analysis',
      'negotiation', 'client_relationship', 'cross_team_collaboration',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'marketing',
    keywords: ['行銷企劃', 'Marketing'],
    role_zh: '行銷',
    interviewGaps: [
      'campaign_strategy', 'brand_management', 'market_research',
      'budget_management', 'data_analysis', 'cross_team_collaboration',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'ui-ux-designer',
    keywords: ['UI設計師', 'UX設計師', 'UI/UX'],
    role_zh: 'UI/UX 設計師',
    interviewGaps: [
      'design_process', 'user_testing', 'design_systems',
      'accessibility', 'cross_team_collaboration', 'project_scale',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'data-engineer',
    keywords: ['資料工程師', 'Data Engineer'],
    role_zh: '資料工程師',
    interviewGaps: [
      'pipeline_architecture', 'data_modeling', 'scalability',
      'data_quality', 'system_design', 'cross_team_collaboration',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'scrum-master',
    keywords: ['Scrum Master', '技術專案經理'],
    role_zh: '技術專案經理 / Scrum Master',
    interviewGaps: [
      'agile_methodology', 'team_facilitation', 'process_improvement',
      'conflict_resolution', 'cross_team_collaboration', 'project_scale',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'customer-success',
    keywords: ['客戶成功', 'Customer Success'],
    role_zh: '客戶成功',
    interviewGaps: [
      'client_retention', 'onboarding_process', 'upselling',
      'customer_advocacy', 'cross_team_collaboration', 'data_analysis',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'security-engineer',
    keywords: ['資安工程師', '資訊安全'],
    role_zh: '資安工程師',
    interviewGaps: [
      'threat_modeling', 'security_architecture', 'incident_response',
      'compliance', 'system_design', 'cross_team_collaboration',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'ml-engineer',
    keywords: ['機器學習工程師', 'ML Engineer'],
    role_zh: '機器學習工程師',
    interviewGaps: [
      'model_development', 'data_pipeline', 'model_deployment',
      'experiment_design', 'system_design', 'cross_team_collaboration',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'solutions-architect',
    keywords: ['解決方案架構師', 'Solutions Architect'],
    role_zh: '解決方案架構師',
    interviewGaps: [
      'solution_design', 'technical_consulting', 'integration_strategy',
      'client_communication', 'system_design', 'cross_team_collaboration',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'product-marketing',
    keywords: ['產品行銷', 'Product Marketing'],
    role_zh: '產品行銷',
    interviewGaps: [
      'go_to_market', 'competitive_analysis', 'messaging_strategy',
      'launch_execution', 'cross_team_collaboration', 'data_analysis',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'technical-support',
    keywords: ['技術支援', 'Technical Support'],
    role_zh: '技術客服',
    interviewGaps: [
      'troubleshooting', 'knowledge_management', 'escalation_process',
      'customer_communication', 'cross_team_collaboration', 'project_scale',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'devops-sre',
    keywords: ['DevOps', 'SRE', 'Site Reliability'],
    role_zh: 'DevOps / SRE',
    interviewGaps: [
      'infrastructure_design', 'monitoring_strategy', 'incident_management',
      'automation', 'system_design', 'cross_team_collaboration',
      'quantified_outcomes', 'technical_leadership',
    ],
  },
  {
    id: 'content-marketing',
    keywords: ['內容行銷', 'Content Marketing'],
    role_zh: '內容行銷',
    interviewGaps: [
      'content_strategy', 'seo_optimization', 'editorial_planning',
      'audience_analysis', 'cross_team_collaboration', 'data_analysis',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
  {
    id: 'ecommerce-operations',
    keywords: ['電商營運', '電商運營'],
    role_zh: '電商營運',
    interviewGaps: [
      'operations_optimization', 'supply_chain', 'conversion_optimization',
      'platform_management', 'cross_team_collaboration', 'data_analysis',
      'quantified_outcomes', 'leadership_experience',
    ],
  },
]
