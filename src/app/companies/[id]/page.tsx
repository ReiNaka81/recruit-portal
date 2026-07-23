import { notFound } from 'next/navigation'
import { getCompanies, getEvents, getCompanyFiles, getProcesses } from '@/lib/data'
import CompanyDetail from '@/components/CompanyDetail'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const companies = getCompanies()
  return companies.map(c => ({ id: c.id }))
}

export default async function CompanyPage({ params }: Props) {
  const { id } = await params
  const companies = getCompanies()
  const events = getEvents()
  const processes = getProcesses()

  const company = companies.find(c => c.id === id)
  if (!company) notFound()

  const companyEvents = events.filter(e => e.companyId === id)
  const companyProcesses = processes.filter(process => process.companyId === id)
  const files = getCompanyFiles(company)

  return (
    <CompanyDetail
      company={company}
      events={companyEvents}
      processes={companyProcesses}
      files={files}
    />
  )
}
