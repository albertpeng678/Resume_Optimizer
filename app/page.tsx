import { getCareerList } from '@/lib/persona/templates'
import { HomeClient } from '@/components/wizard/HomeClient'

export default function HomePage() {
  const careers = getCareerList()
  return (
    <HomeClient careers={careers} />
  )
}
