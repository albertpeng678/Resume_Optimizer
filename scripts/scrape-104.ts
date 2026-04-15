import fs from 'fs'
import path from 'path'
import { CAREERS, LEVELS, type CareerConfig, type LevelConfig } from './career-config'

const BASE_DIR = path.join(__dirname, 'jd-data')

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.104.com.tw/',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxRetries) return res
        const backoff = Math.min(2000 * Math.pow(2, attempt), 30000)
        console.warn(`  ⏳ Retry ${attempt + 1}/${maxRetries} after ${backoff}ms (HTTP ${res.status})`)
        await sleep(backoff)
        continue
      }
      return res
    } catch (err) {
      if (attempt === maxRetries) throw err
      const backoff = Math.min(2000 * Math.pow(2, attempt), 30000)
      console.warn(`  ⏳ Retry ${attempt + 1}/${maxRetries} after ${backoff}ms (network error)`)
      await sleep(backoff)
    }
  }
  throw new Error('Unreachable')
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
  employees: number
}

async function searchJobs(
  keyword: string,
  exp: string,
  maxPages = 5
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      ro: '0',
      kwop: '7',
      keyword,
      expansionType: 'area,spec,com,job,wf,wfprice',
      order: '14',
      asc: '0',
      page: String(page),
      mode: 's',
      jobsource: '2018indexpoc',
    })
    // exp can be "1,2" — append each value separately
    exp.split(',').forEach((v) => params.append('exp', v.trim()))

    const url = `https://www.104.com.tw/jobs/search/list?${params}`
    const res = await fetchWithRetry(url)
    if (!res.ok) {
      console.warn(`  Search page ${page} failed: HTTP ${res.status}`)
      break
    }

    const data: any = await res.json()
    const list: any[] = data?.data?.list ?? []
    if (list.length === 0) break

    for (const item of list) {
      const applyCnt = Number(item.applyCnt) || 0
      const appearDate = item.appearDate ?? ''
      const employees = Number(item.employees) || 0

      // Layer 1 filter: applyCnt, employees, date freshness
      if (applyCnt < 20) continue
      if (employees > 0 && employees < 100) continue
      if (appearDate && new Date(appearDate) < thirtyDaysAgo) continue

      results.push({
        jobNo: item.link?.job?.replace(/.*\//, '') ?? item.jobNo ?? '',
        jobName: item.jobName ?? '',
        custName: item.custName ?? '',
        applyCnt,
        appearDate,
        employees,
      })
    }

    console.log(`    Page ${page}: ${list.length} raw, ${results.length} passed filter so far`)
    await sleep(1200)
  }

  return results
}

interface JobDetail {
  jobName: string
  custName: string
  description: string
  skills: string[]
  descriptionLength: number
}

async function getJobDetail(
  jobNo: string,
  custName: string
): Promise<JobDetail | null> {
  const url = `https://www.104.com.tw/job/ajax/content/${jobNo}`
  const res = await fetchWithRetry(url)
  if (!res.ok) return null

  const data: any = await res.json()
  const d = data?.data
  if (!d) return null

  const jobDetail = d.jobDetail ?? {}
  const condition = d.condition ?? {}

  const description = [
    jobDetail.jobDescription ?? '',
    jobDetail.workContent ?? '',
    condition.other ?? '',
  ]
    .filter(Boolean)
    .join('\n')

  // Only exclude nearly-empty descriptions; caller sorts by length and picks top N
  if (description.length < 50) return null

  const specialty: string[] = (condition.specialty ?? [])
    .map((s: any) => (typeof s === 'string' ? s : s?.description ?? ''))
    .filter(Boolean)
  const skill: string[] = (condition.skill ?? [])
    .map((s: any) => (typeof s === 'string' ? s : s?.description ?? ''))
    .filter(Boolean)

  const skills = [...specialty, ...skill]

  return {
    jobName: d.header?.jobName ?? jobDetail.jobName ?? '',
    custName: custName,
    description,
    skills,
    descriptionLength: description.length,
  }
}

async function scrapeCombo(
  career: CareerConfig,
  level: LevelConfig,
  comboIndex: number,
  totalCombos: number
): Promise<{ collected: number; skipped: boolean }> {
  const existing = countExistingJobs(career.id, level.id)
  if (existing >= 10) {
    console.log(`[${comboIndex}/${totalCombos}] ${career.id}/${level.id}: SKIP (already ${existing} jobs)`)
    return { collected: existing, skipped: true }
  }

  console.log(`\n[${comboIndex}/${totalCombos}] ${career.id}/${level.id} (${career.role_zh} ${level.years_zh})`)

  // Try each keyword, collect candidates
  let candidates: SearchResult[] = []
  for (const keyword of career.keywords) {
    console.log(`  Searching: "${keyword}" exp=${level.exp}`)
    const results = await searchJobs(keyword, level.exp)
    candidates.push(...results)
    if (candidates.length >= 30) break // enough candidates
    await sleep(1000)
  }

  // Deduplicate by jobNo
  const seen = new Set<string>()
  candidates = candidates.filter((c) => {
    if (!c.jobNo || seen.has(c.jobNo)) return false
    seen.add(c.jobNo)
    return true
  })

  console.log(`  ${candidates.length} unique candidates after Layer 1 filter`)

  // Fetch details for up to 30 candidates (to have enough to pick from)
  const maxToFetch = Math.min(candidates.length, 30)
  const detailResults: Array<{ candidate: SearchResult; detail: JobDetail }> = []

  for (let i = 0; i < maxToFetch; i++) {
    const candidate = candidates[i]
    const detail = await getJobDetail(candidate.jobNo, candidate.custName)
    if (detail) {
      detailResults.push({ candidate, detail })
      console.log(`  📄 [${detailResults.length}] ${detail.jobName} (${detail.descriptionLength} chars)`)
    }
    await sleep(800)
  }

  // Sort by description length descending, take top 10
  detailResults.sort((a, b) => b.detail.descriptionLength - a.detail.descriptionLength)
  const topResults = detailResults.slice(0, 10 - existing)

  console.log(`  Fetched ${detailResults.length} details, taking top ${topResults.length} by description length`)

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
        careerId: career.id,
        levelId: level.id,
        scrapedAt: new Date().toISOString(),
      },
    }
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2))
    console.log(`  ✓ [${collected}/10] ${detail.jobName} @ ${detail.custName} (${descriptionLength} chars)`)
  }

  if (collected < 10) {
    console.log(`  ⚠ Only ${collected}/10 jobs available for this combo`)
  }

  return { collected, skipped: false }
}

async function main() {
  const args = parseCliArgs()

  // Filter careers/levels by CLI args
  const careers = args.career
    ? CAREERS.filter((c) => c.id === args.career)
    : CAREERS
  const levels = args.level
    ? LEVELS.filter((l) => l.id === args.level)
    : LEVELS

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
  console.log(`\n=== 104 Job Scraper ===`)
  console.log(`Careers: ${careers.length}, Levels: ${levels.length}, Total combos: ${totalCombos}`)

  // Resume check
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

  const startTime = Date.now()
  let comboIndex = 0
  let totalCollected = 0
  let skippedCount = 0
  const failedCombos: string[] = []

  for (const career of careers) {
    for (const level of levels) {
      comboIndex++
      const { collected, skipped } = await scrapeCombo(career, level, comboIndex, totalCombos)
      totalCollected += collected
      if (skipped) skippedCount++
      if (collected < 5 && !skipped) failedCombos.push(`${career.id}/${level.id} (${collected})`)

      // Pause between combos
      if (!skipped) await sleep(3000)
    }
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
