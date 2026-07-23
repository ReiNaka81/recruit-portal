import CompaniesClient from '@/components/CompaniesClient'
import { getCategories, getCompanies, getEvents, getProcesses } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default function CompaniesPage() {
  const companies = getCompanies()
  const events = getEvents()
  const categories = getCategories()
  const processes = getProcesses()

  return (
    <CompaniesClient
      companies={companies}
      events={events}
      categories={categories}
      processes={processes}
    />
  )
}
