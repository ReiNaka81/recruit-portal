import { getCompanies, getEvents, getCategories, getProcesses } from '@/lib/data'
import CalendarClient from '@/components/CalendarClient'
import { Company, InternEvent } from '@/types'
import { getTrackingState } from '@/lib/status'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: {
    event: InternEvent
    company: Company
  }
}

// FullCalendar で最終日の描画がずれないようにするためのオフセット
function addOneDay(dateStr: string) {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 1)
  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

export default function CalendarPage() {
  const companies = getCompanies()
  const events = getEvents()
  const categories = getCategories()
  const processes = getProcesses()

  const activeCompanies = companies.filter(c => getTrackingState(c) === 'active')
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]))

  const calendarEvents: CalendarEvent[] = events
    .map(event => {
      const company = companyMap[event.companyId]
      if (!company) return null
      if (getTrackingState(company) !== 'active') return null
      const isDeadline = event.type === 'deadline'
      const allDay = isDeadline ? true : !event.start.includes('T')
      const actualEnd = isDeadline ? event.start : event.end
      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: allDay ? addOneDay(actualEnd || event.start) : actualEnd,
        allDay,
        backgroundColor: company.color,
        borderColor: company.color,
        textColor: '#ffffff',
        extendedProps: { event, company },
      }
    })
    .filter((e): e is CalendarEvent => e !== null)

  return (
    <CalendarClient
      events={calendarEvents}
      companies={activeCompanies}
      categories={categories}
      processes={processes}
    />
  )
}
