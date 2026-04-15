import fs from 'fs'
import path from 'path'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.104.com.tw/',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
}

interface Job104 {
  jobNo: string
  jobName: string
  custName: string
}

async function searchJobs(keyword: string, pages = 3): Promise<Job104[]> {
  const jobs: Job104[] = []

  for (let page = 1; page <= pages; page++) {
    const url = `https://www.104.com.tw/jobs/search/list?ro=0&kwop=7&keyword=${encodeURIComponent(
      keyword
    )}&expansionType=area,spec,com,job,wf,wfprice&area=6001001000&order=14&asc=0&page=${page}&mode=s&jobsource=2018indexpoc`

    try {
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) {
        console.warn(`  Search page ${page} failed: ${res.status}`)
        continue
      }
      const data: any = await res.json()
      const list: Job104[] = data?.data?.list ?? []
      jobs.push(...list)
      console.log(`  Page ${page}: ${list.length} jobs found`)
      await new Promise((r) => setTimeout(r, 1000))
    } catch (e) {
      console.error(`  Error fetching page ${page}:`, e)
    }
  }

  return jobs
}

async function getJobDetail(jobNo: string): Promise<any | null> {
  const url = `https://www.104.com.tw/job/ajax/content/${jobNo}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return null
    const data: any = await res.json()
    return data?.data ?? null
  } catch {
    return null
  }
}

async function main() {
  const searches = [
    { keyword: '產品經理 3年', filename: 'pdm-mid-raw.json' },
    { keyword: '資深產品經理 Senior PM', filename: 'pdm-senior-raw.json' },
    { keyword: '資深軟體工程師 Senior Engineer', filename: 'swe-senior-raw.json' },
  ]

  fs.mkdirSync('scripts/jd-data', { recursive: true })

  for (const { keyword, filename } of searches) {
    console.log(`\nSearching: ${keyword}`)
    const jobs = await searchJobs(keyword, 3)

    const detailed: Array<{
      jobName: string
      custName: string
      description: string
      skills: string[]
    }> = []

    for (const job of jobs.slice(0, 20)) {
      console.log(`  Fetching detail: ${job.jobName}`)
      const detail = await getJobDetail(job.jobNo)
      if (!detail) continue

      const jobDetail = detail.jobDetail ?? {}
      const condition = detail.condition ?? {}
      detailed.push({
        jobName: job.jobName ?? '',
        custName: job.custName ?? '',
        description: [
          jobDetail.jobDescription ?? '',
          jobDetail.workContent ?? '',
          condition.other ?? '',
        ]
          .filter(Boolean)
          .join('\n'),
        skills: [
          ...((condition.specialty ?? []).map((s: any) => s?.description ?? s)),
          ...((condition.skill ?? []).map((s: any) => s?.description ?? s)),
        ].filter(Boolean),
      })

      await new Promise((r) => setTimeout(r, 600))
    }

    fs.writeFileSync(
      path.join('scripts/jd-data', filename),
      JSON.stringify(detailed, null, 2)
    )
    console.log(`Saved ${detailed.length} jobs to scripts/jd-data/${filename}`)
  }
}

main().catch(console.error)
