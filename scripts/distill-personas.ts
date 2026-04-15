import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface RawJob {
  jobName: string
  custName: string
  description: string
  skills: string[]
}

async function distillPersona(
  role: string,
  personaId: string,
  jobs: RawJob[],
  interviewGaps: string[]
): Promise<object> {
  const jobSample = jobs
    .slice(0, 15)
    .map(
      (j, i) =>
        `--- JD ${i + 1}: ${j.jobName} @ ${j.custName} ---\n${j.description}\n技能: ${j.skills.join(', ')}`
    )
    .join('\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是一位熟悉台灣職場的職涯顧問。根據以下真實 JD 樣本，蒸餾出代表性的 Persona 模板。

你的任務是：
1. 分析這些 JD 的共同模式
2. 提取頻率 > 60% 的核心技能、關鍵字、職責
3. 生成一份代表台灣市場的 Persona 模板

請以此 JSON 格式回應（不要包含任何其他文字）：
{
  "id": "${personaId}",
  "title": "（職位名稱）",
  "years": "（年資要求）",
  "core_skills": ["（5-7 個核心能力，台灣市場最常見的）"],
  "keywords": ["（10-15 個關鍵字，ATS 常見的，包含英中文）"],
  "responsibilities": ["（4-6 條職責，從 JD 中歸納）"],
  "interview_gaps": ${JSON.stringify(interviewGaps)}
}`,
      },
      {
        role: 'user',
        content: `以下是 ${jobs.length} 份 ${role} 的真實 JD 樣本：\n\n${jobSample}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('Empty response')
  return JSON.parse(content)
}

async function main() {
  const configs = [
    {
      role: '產品經理（中階）',
      personaId: 'pdm-mid',
      file: 'pdm-mid-raw.json',
      interviewGaps: [
        'product_planning',
        'data_analysis',
        'cross_team_collaboration',
        'user_research',
        'project_scale',
        'technical_background',
        'quantified_outcomes',
        'leadership_experience',
      ],
    },
    {
      role: '資深產品經理',
      personaId: 'pdm-senior',
      file: 'pdm-senior-raw.json',
      interviewGaps: [
        'product_vision',
        'business_impact',
        'team_leadership',
        'market_strategy',
        'stakeholder_influence',
        'platform_thinking',
        'quantified_outcomes',
        'organizational_change',
      ],
    },
    {
      role: '資深軟體工程師',
      personaId: 'swe-senior',
      file: 'swe-senior-raw.json',
      interviewGaps: [
        'system_design',
        'technical_complexity',
        'performance_impact',
        'team_mentoring',
        'architecture_decisions',
        'cross_functional_collab',
        'quantified_outcomes',
        'technical_leadership',
      ],
    },
  ]

  for (const cfg of configs) {
    const rawPath = path.join('scripts/jd-data', cfg.file)
    if (!fs.existsSync(rawPath)) {
      console.warn(`Missing: ${rawPath}, skipping`)
      continue
    }

    const jobs = JSON.parse(fs.readFileSync(rawPath, 'utf-8')) as RawJob[]
    if (jobs.length === 0) {
      console.warn(`Empty dataset: ${rawPath}, skipping`)
      continue
    }
    console.log(`\nDistilling ${cfg.role} from ${jobs.length} JDs...`)

    const persona = await distillPersona(cfg.role, cfg.personaId, jobs, cfg.interviewGaps)

    const outputPath = path.join('persona-templates', `${cfg.personaId}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(persona, null, 2))
    console.log(`Updated ${outputPath}`)
    console.log(JSON.stringify(persona, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
