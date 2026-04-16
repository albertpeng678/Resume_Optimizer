import fs from 'fs'
import path from 'path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { CAREERS, LEVELS, type CareerConfig, type LevelConfig } from './career-config'

const BASE_DIR = path.join(__dirname, 'jd-data')

// 軟體資訊產業白名單（coIndustryDesc 包含這些關鍵字即通過）
const INDUSTRY_KEYWORDS = [
  '軟體',
  '網際網路',
  '電腦系統整合',
  '資訊',
  '數位內容',
  '多媒體',
  '電子商務',
  '雲端',
  'IC設計',
  '半導體',
  '通訊',
  '電信',
  '資料處理',
  '區塊鏈',
]

function isTargetIndustry(industryDesc: string): boolean {
  if (!industryDesc) return false
  return INDUSTRY_KEYWORDS.some((kw) => industryDesc.includes(kw))
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function getOutputDir(careerId: string, levelId: string): string {
  return path.join(BASE_DIR, careerId, levelId)
}

function countExistingJobs(careerId: string, levelId: string): number {
  const dir = getOutputDir(careerId, levelId)
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length
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

interface SearchResult {
  jobNo: string
  jobName: string
  custName: string
  applyCnt: number
  appearDate: string
  employeeCount: number
}

interface JobDetail {
  jobName: string
  custName: string
  description: string
  skills: string[]
  descriptionLength: number
}

// Intercept JSON API response from page navigation
async function interceptJsonResponse(
  page: Page,
  urlPattern: string | RegExp,
  navigationFn: () => Promise<void>,
  timeout = 30000
): Promise<any | null> {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => resolve(null), timeout)
    const handler = async (response: any) => {
      const url = response.url()
      const matches =
        typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url)
      if (matches) {
        try {
          const json = await response.json()
          clearTimeout(timer)
          page.off('response', handler)
          resolve(json)
        } catch {}
      }
    }
    page.on('response', handler)
    try {
      await navigationFn()
    } catch {
      clearTimeout(timer)
      page.off('response', handler)
      resolve(null)
    }
  })
}

async function searchJobs(
  page: Page,
  keyword: string,
  exp: string,
  maxPages = 5
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const expParams = exp
      .split(',')
      .map((v) => `exp=${v.trim()}`)
      .join('&')
    const searchUrl = `https://www.104.com.tw/jobs/search/?keyword=${encodeURIComponent(keyword)}&${expParams}&order=15&page=${pageNum}`

    const apiData = await interceptJsonResponse(
      page,
      '/jobs/search/api/jobs',
      () => page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 }).then(() => {}),
      20000
    )

    if (!apiData) {
      console.warn(`    Page ${pageNum}: no API data captured`)
      break
    }

    // API returns { data: { "0": {...}, "1": {...}, ... }, metadata: { pagination: {...} } }
    const dataObj = apiData.data ?? {}
    const pagination = apiData.metadata?.pagination ?? {}
    const list: any[] = Object.values(dataObj).filter(
      (v: any) => v && typeof v === 'object' && v.jobNo
    )

    if (list.length === 0) break

    for (const item of list) {
      const applyCnt = Number(item.applyCnt) || 0
      const rawDate = String(item.appearDate ?? '')
      const employeeCount = Number(item.employeeCount) || 0

      const industryDesc: string = item.coIndustryDesc ?? ''

      // Layer 1 filter
      if (!isTargetIndustry(industryDesc)) continue
      if (applyCnt < 5) continue
      // Date filter: appearDate format "20260413"
      if (rawDate.length === 8) {
        const d = new Date(
          `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        )
        if (d < thirtyDaysAgo) continue
      }

      // Extract jobNo from link or field
      const jobLink: string = item.link?.job ?? ''
      const jobNo = jobLink.replace(/.*\//, '') || String(item.jobNo || '')

      results.push({
        jobNo,
        jobName: item.jobName ?? '',
        custName: item.custName ?? '',
        applyCnt,
        appearDate: rawDate,
        employeeCount,
      })
    }

    console.log(
      `    Page ${pageNum}: ${list.length} raw, ${results.length} passed filter so far`
    )

    if (pageNum >= (pagination.lastPage ?? 1)) break
    await sleep(1500)
  }

  return results
}

async function getJobDetail(
  page: Page,
  jobNo: string,
  custName: string
): Promise<JobDetail | null> {
  const jobUrl = `https://www.104.com.tw/job/${jobNo}`

  const apiData = await interceptJsonResponse(
    page,
    `/api/jobs/${jobNo}`,
    () => page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 45000 }).then(() => {}),
    20000
  )

  if (!apiData?.data) return null
  const d = apiData.data

  const jobDetail = d.jobDetail ?? {}
  const condition = d.condition ?? {}

  const description = [jobDetail.jobDescription ?? '', condition.other ?? '']
    .filter(Boolean)
    .join('\n')

  if (description.length < 50) return null

  const specialty: string[] = (condition.specialty ?? [])
    .map((s: any) => (typeof s === 'string' ? s : s?.description ?? ''))
    .filter(Boolean)
  const skill: string[] = (condition.skill ?? [])
    .map((s: any) => (typeof s === 'string' ? s : s?.description ?? ''))
    .filter(Boolean)

  return {
    jobName: d.header?.jobName ?? jobDetail.jobName ?? '',
    custName,
    description,
    skills: [...specialty, ...skill],
    descriptionLength: description.length,
  }
}

async function scrapeCombo(
  page: Page,
  career: CareerConfig,
  level: LevelConfig,
  comboIndex: number,
  totalCombos: number
): Promise<{ collected: number; skipped: boolean }> {
  const existing = countExistingJobs(career.id, level.id)
  if (existing >= 10) {
    console.log(
      `[${comboIndex}/${totalCombos}] ${career.id}/${level.id}: SKIP (already ${existing} jobs)`
    )
    return { collected: existing, skipped: true }
  }

  console.log(
    `\n[${comboIndex}/${totalCombos}] ${career.id}/${level.id} (${career.role_zh} ${level.years_zh})`
  )

  // Try each keyword, collect candidates
  let candidates: SearchResult[] = []
  for (const keyword of career.keywords) {
    console.log(`  Searching: "${keyword}" exp=${level.exp}`)
    const results = await searchJobs(page, keyword, level.exp)
    candidates.push(...results)
    if (candidates.length >= 30) break
    await sleep(1500)
  }

  // Deduplicate by jobNo
  const seen = new Set<string>()
  candidates = candidates.filter((c) => {
    if (!c.jobNo || seen.has(c.jobNo)) return false
    seen.add(c.jobNo)
    return true
  })

  console.log(`  ${candidates.length} unique candidates after Layer 1 filter`)

  // Fetch details for up to 25 candidates
  const maxToFetch = Math.min(candidates.length, 25)
  const detailResults: Array<{ candidate: SearchResult; detail: JobDetail }> = []

  for (let i = 0; i < maxToFetch; i++) {
    const candidate = candidates[i]
    console.log(`  Fetching detail [${i + 1}/${maxToFetch}]: ${candidate.jobName}...`)
    const detail = await getJobDetail(page, candidate.jobNo, candidate.custName)
    if (detail) {
      detailResults.push({ candidate, detail })
      console.log(
        `  📄 [${detailResults.length}] ${detail.jobName} (${detail.descriptionLength} chars)`
      )
    }
    // Enough good results — stop early
    if (detailResults.length >= 15) break
    await sleep(1200)
  }

  // Sort by description length descending, take top 10
  detailResults.sort((a, b) => b.detail.descriptionLength - a.detail.descriptionLength)
  const topResults = detailResults.slice(0, 10 - existing)

  console.log(
    `  Fetched ${detailResults.length} details, taking top ${topResults.length} by description length`
  )

  // Write individual JSON files
  const outDir = getOutputDir(career.id, level.id)
  fs.mkdirSync(outDir, { recursive: true })

  let collected = existing
  for (const { candidate, detail } of topResults) {
    collected++
    const fileNum = String(collected).padStart(3, '0')
    const filePath = path.join(outDir, `job_${fileNum}.json`)
    const { descriptionLength, ...detailWithoutLength } = detail
    const output = {
      ...detailWithoutLength,
      meta: {
        jobNo: candidate.jobNo,
        applyCnt: candidate.applyCnt,
        appearDate: candidate.appearDate,
        employeeCount: candidate.employeeCount,
        careerId: career.id,
        levelId: level.id,
        scrapedAt: new Date().toISOString(),
      },
    }
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2))
    console.log(
      `  ✓ [${collected}/10] ${detail.jobName} @ ${detail.custName} (${descriptionLength} chars)`
    )
  }

  if (collected < 10) {
    console.log(`  ⚠ Only ${collected}/10 jobs available for this combo`)
  }

  return { collected, skipped: false }
}

async function main() {
  const args = parseCliArgs()

  const careers = args.career ? CAREERS.filter((c) => c.id === args.career) : CAREERS
  const levels = args.level ? LEVELS.filter((l) => l.id === args.level) : LEVELS

  if (careers.length === 0) {
    console.error(`Unknown career: ${args.career}`)
    console.error(`Available: ${CAREERS.map((c) => c.id).join(', ')}`)
    process.exit(1)
  }
  if (levels.length === 0) {
    console.error(`Unknown level: ${args.level}`)
    console.error(`Available: ${LEVELS.map((l) => l.id).join(', ')}`)
    process.exit(1)
  }

  const totalCombos = careers.length * levels.length
  console.log(`\n=== 104 Job Scraper (Playwright) ===`)
  console.log(
    `Careers: ${careers.length}, Levels: ${levels.length}, Total combos: ${totalCombos}`
  )

  let alreadyDone = 0
  for (const career of careers) {
    for (const level of levels) {
      if (countExistingJobs(career.id, level.id) >= 10) alreadyDone++
    }
  }
  if (alreadyDone > 0) {
    console.log(`Resume: ${alreadyDone}/${totalCombos} already complete`)
  }
  console.log('')

  // Launch browser
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Warm up: visit 104 homepage to get Cloudflare cookies
  console.log('Warming up (visiting 104 homepage)...')
  await page.goto('https://www.104.com.tw/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await sleep(2000)

  const startTime = Date.now()
  let comboIndex = 0
  let totalCollected = 0
  let skippedCount = 0
  const failedCombos: string[] = []

  try {
    for (const career of careers) {
      for (const level of levels) {
        comboIndex++
        const { collected, skipped } = await scrapeCombo(
          page,
          career,
          level,
          comboIndex,
          totalCombos
        )
        totalCollected += collected
        if (skipped) skippedCount++
        if (collected < 5 && !skipped)
          failedCombos.push(`${career.id}/${level.id} (${collected})`)

        if (!skipped) await sleep(3000)
      }
    }
  } finally {
    await browser.close()
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  console.log(`\n=== Scrape Complete ===`)
  console.log(`Total combos: ${totalCombos}`)
  console.log(`Skipped (already done): ${skippedCount}`)
  console.log(`Processed: ${totalCombos - skippedCount}`)
  console.log(`Total jobs collected: ${totalCollected}`)
  console.log(`Duration: ${minutes}m ${seconds}s`)
  if (failedCombos.length > 0) {
    console.log(`\n⚠ Low-yield combos:`)
    failedCombos.forEach((c) => console.log(`  - ${c}`))
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
