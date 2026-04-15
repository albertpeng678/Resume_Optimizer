import pdmMid from '@/persona-templates/pdm-mid.json'
import pdmSenior from '@/persona-templates/pdm-senior.json'
import sweSenior from '@/persona-templates/swe-senior.json'

export interface PersonaTemplate {
  id: string
  title: string
  years: string
  core_skills: string[]
  keywords: string[]
  responsibilities: string[]
  interview_gaps: string[]
}

const TEMPLATES: Record<string, PersonaTemplate> = {
  'pdm-mid': pdmMid as PersonaTemplate,
  'pdm-senior': pdmSenior as PersonaTemplate,
  'swe-senior': sweSenior as PersonaTemplate,
}

export function getPersona(id: string): PersonaTemplate | null {
  return TEMPLATES[id] ?? null
}

export function getAllPersonas(): PersonaTemplate[] {
  return Object.values(TEMPLATES)
}
