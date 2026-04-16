import fs from 'fs'
import path from 'path'

export interface PersonaTemplate {
  id: string
  title: string
  years: string
  core_skills: string[]
  keywords: string[]
  responsibilities: string[]
  interview_gaps: string[]
}

const TEMPLATES_DIR = path.join(process.cwd(), 'persona-templates')

let _cache: Record<string, PersonaTemplate> | null = null

function loadTemplates(): Record<string, PersonaTemplate> {
  if (_cache) return _cache

  _cache = {}
  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8'))
    _cache[data.id] = data as PersonaTemplate
  }
  return _cache
}

export function getPersona(id: string): PersonaTemplate | null {
  return loadTemplates()[id] ?? null
}

export function getAllPersonas(): PersonaTemplate[] {
  return Object.values(loadTemplates())
}

export interface CareerInfo {
  id: string
  title: string
  description: string
}

export function getCareerList(): CareerInfo[] {
  const templates = loadTemplates()
  const byCareer = new Map<string, Record<string, PersonaTemplate>>()

  for (const persona of Object.values(templates)) {
    const careerId = persona.id.replace(/-(junior|mid|senior)$/, '')
    const level = persona.id.replace(`${careerId}-`, '')
    if (!byCareer.has(careerId)) byCareer.set(careerId, {})
    byCareer.get(careerId)![level] = persona
  }

  return Array.from(byCareer.entries()).map(([careerId, levels]) => {
    const preferred = levels['mid'] ?? levels['junior'] ?? levels['senior']
    return {
      id: careerId,
      title: preferred.title,
      description: preferred.responsibilities.slice(0, 2).join('、'),
    }
  })
}
