import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { CAREERS, LEVELS, type CareerConfig, type LevelConfig } from './career-config'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const JD_DATA_DIR = path.join(__dirname, 'jd-data')
const OUTPUT_DIR = path.join(__dirname, '..', 'persona-templates')

interface RawJob {
  jobName: string
  custName: string
  description: string
  skills: string[]
}

function loadJobs(careerId: string, levelId: string): RawJob[] {
  const dir = path.join(JD_DATA_DIR, careerId, levelId)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      return {
        jobName: raw.jobName ?? '',
        custName: raw.custName ?? '',
        description: raw.description ?? '',
        skills: raw.skills ?? [],
      }
    })
}

async function distillPersona(
  career: CareerConfig,
  level: LevelConfig,
  jobs: RawJob[]
): Promise<object> {
  const personaId = `${career.id}-${level.id}`

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
        content: `你是一位熟悉台灣軟體資訊產業的職涯顧問。根據以下真實 JD 樣本，蒸餾出代表性的 Persona 模板。

你的任務是：
1. 分析這些 JD 的共同模式
2. 提取頻率 > 60% 的核心技能、關鍵字、職責
3. 生成一份代表台灣軟體資訊業市場的 Persona 模板

請以此 JSON 格式回應（不要包含任何其他文字）：
{
  "id": "${personaId}",
  "title": "（職位名稱，中文）",
  "years": "${level.years_zh}",
  "core_skills": ["（5-7 個核心能力，台灣軟體資訊業市場最常見的）"],
  "keywords": ["（10-15 個關鍵字，ATS 常見的，包含英中文）"],
  "responsibilities": ["（4-6 條職責，從 JD 中歸納）"],
  "interview_gaps": ${JSON.stringify(career.interviewGaps)}
}`,
      },
      {
        role: 'user',
        content: `以下是 ${jobs.length} 份台灣軟體資訊業「${career.role_zh}」（${level.years_zh}經驗）的真實 JD 樣本：\n\n${jobSample}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('Empty response')
  return JSON.parse(content)
}

function parseCliArgs(): { career?: string; level?: string } {
  const args = process.argv.slice(2)
  const result: { career?: string; level?: string } = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--career' && args[i + 1]) result.career = args[i + 1]
    if (args[i] === '--level' && args[i + 1]) result.level = args[i + 1]
  }
  return result
}

async function main() {
  const args = parseCliArgs()

  const careers = args.career ? CAREERS.filter((c) => c.id === args.career) : CAREERS
  const levels = args.level ? LEVELS.filter((l) => l.id === args.level) : LEVELS

  if (careers.length === 0) {
    console.error(`Unknown career: ${args.career}`)
    process.exit(1)
  }
  if (levels.length === 0) {
    console.error(`Unknown level: ${args.level}`)
    process.exit(1)
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const totalCombos = careers.length * levels.length
  let comboIndex = 0
  let successCount = 0
  let skipCount = 0

  console.log(`\n=== Persona Distiller ===`)
  console.log(`Careers: ${careers.length}, Levels: ${levels.length}, Total: ${totalCombos}\n`)

  for (const career of careers) {
    for (const level of levels) {
      comboIndex++
      const personaId = `${career.id}-${level.id}`
      const outputPath = path.join(OUTPUT_DIR, `${personaId}.json`)

      // Check if already distilled
      if (fs.existsSync(outputPath)) {
        console.log(`[${comboIndex}/${totalCombos}] ${personaId}: SKIP (already exists)`)
        skipCount++
        continue
      }

      const jobs = loadJobs(career.id, level.id)
      if (jobs.length === 0) {
        console.warn(`[${comboIndex}/${totalCombos}] ${personaId}: SKIP (no JD data)`)
        skipCount++
        continue
      }

      console.log(
        `[${comboIndex}/${totalCombos}] Distilling ${personaId} (${career.role_zh} ${level.years_zh}) from ${jobs.length} JDs...`
      )

      try {
        const persona = await distillPersona(career, level, jobs)
        fs.writeFileSync(outputPath, JSON.stringify(persona, null, 2))
        console.log(`  ✓ ${outputPath}`)
        successCount++
      } catch (e: any) {
        console.error(`  ✗ Failed: ${e.message}`)
      }
    }
  }

  console.log(`\n=== Distill Complete ===`)
  console.log(`Success: ${successCount}, Skipped: ${skipCount}, Total: ${totalCombos}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
