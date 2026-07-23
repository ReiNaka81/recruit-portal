import Link from 'next/link'
import HashOpener from '@/components/HashOpener'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCategories, getCompanies, getEvents, getProcesses } from '@/lib/data'
import {
  COMPANY_DISPLAY_META,
  CompanyDisplayState,
  PROCESS_RESULT_META,
  STEP_STATE_META,
  deriveCompanyDisplayState,
  getCurrentStep,
  getPrimaryProcess,
  getTrackingState,
} from '@/lib/status'
import { Company } from '@/types'

export const dynamic = 'force-dynamic'

const DISPLAY_ORDER: CompanyDisplayState[] = [
  'action_required',
  'awaiting_result',
  'scheduled',
  'active',
  'accepted',
  'offered',
  'considering',
  'completed',
]

function localYmd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ProcessLine({
  company,
  processName,
  detail,
}: {
  company: Company
  processName: string
  detail: string
}) {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="block min-w-0 max-w-full rounded-lg border bg-card px-3 py-2 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: company.color }} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{company.name}</span>
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {processName} · {detail}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const companies = getCompanies()
  const events = getEvents()
  const processes = getProcesses()
  const categories = getCategories()

  const activeCompanies = companies.filter(company => getTrackingState(company) === 'active')
  const holdCount = companies.filter(company => getTrackingState(company) === 'hold').length
  const archivedCount = companies.filter(company => getTrackingState(company) === 'archived').length
  const companyMap = new Map(companies.map(company => [company.id, company]))

  const rows = activeCompanies.map(company => {
    const companyProcesses = processes.filter(process => process.companyId === company.id)
    const primary = getPrimaryProcess(company, companyProcesses)
    const currentStep = getCurrentStep(primary)
    const displayState = deriveCompanyDisplayState(company, companyProcesses)
    const companyEvents = events.filter(event => event.companyId === company.id)
    const nextEvent = companyEvents
      .filter(event => event.state !== 'done' && event.state !== 'cancelled' && new Date(event.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]
    return { company, companyProcesses, primary, currentStep, displayState, nextEvent }
  })

  const grouped = Object.fromEntries(
    DISPLAY_ORDER.map(state => [state, rows.filter(row => row.displayState === state)])
  ) as Record<CompanyDisplayState, typeof rows>

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const timeline = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    const key = localYmd(date)
    const items = events
      .filter(event => {
        if (event.state === 'cancelled') return false
        const start = event.start.split('T')[0]
        const end = (event.end || event.start).split('T')[0]
        return key >= start && key <= end
      })
      .sort((a, b) => a.start.localeCompare(b.start))
    return { date, key, items }
  })

  const acceptedProcesses = processes.filter(process => process.result === 'accepted')
  const offeredProcesses = processes.filter(process => process.result === 'offered')
  const needsReview = processes.filter(process => process.name.includes('要確認')).length

  return (
    <div id="top" className="p-4 sm:p-6">
      <HashOpener />
      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold">就活ダッシュボード</h1>
        <span className="text-sm text-muted-foreground">
          追跡中 {activeCompanies.length}社
          {holdCount > 0 && (
            <Link href="/companies?status=hold" className="ml-2 hover:underline">
              保留 {holdCount}
            </Link>
          )}
          {archivedCount > 0 && (
            <Link href="/companies?status=archived" className="ml-2 hover:underline">
              終了 {archivedCount}
            </Link>
          )}
        </span>
      </div>

      {needsReview > 0 && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          既存データから移行した選考プロセスが {needsReview}件あります。
          企業詳細で名称・種類・現在ステップを確認してください。
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">要対応</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-red-700">
            {grouped.action_required.length}<span className="ml-1 text-sm font-normal">社</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">結果待ち</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">
            {grouped.awaiting_result.length}<span className="ml-1 text-sm font-normal">社</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">参加確定</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-sky-700">
            {acceptedProcesses.length}<span className="ml-1 text-sm font-normal">件</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">内定</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-cyan-700">
            {offeredProcesses.length}<span className="ml-1 text-sm font-normal">件</span>
          </CardContent>
        </Card>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">直近1週間</h2>
          <span className="text-xs text-muted-foreground">
            {localYmd(today)}〜{timeline.at(-1)?.key}
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {timeline.map(({ date, key, items }, index) => (
            <div
              key={key}
              className={`min-h-28 rounded-lg border p-2 ${index === 0 ? 'border-foreground ring-1 ring-foreground' : 'bg-card'}`}
            >
              <div className="mb-2 text-center">
                <div className="text-[11px] text-muted-foreground">
                  {date.toLocaleDateString('ja-JP', { weekday: 'short' })}
                </div>
                <div className="text-sm font-semibold">{date.getMonth() + 1}/{date.getDate()}</div>
              </div>
              <div className="space-y-1">
                {items.length === 0 && <div className="text-center text-xs text-muted-foreground">予定なし</div>}
                {items.slice(0, 3).map(event => {
                  const company = companyMap.get(event.companyId)
                  return (
                    <Link
                      key={event.id}
                      href={company ? `/companies/${company.id}` : '#'}
                      className="block truncate rounded px-1.5 py-1 text-[10px]"
                      style={{
                        backgroundColor: `${company?.color ?? '#888'}20`,
                        borderLeft: `3px solid ${company?.color ?? '#888'}`,
                      }}
                      title={`${company?.name ?? ''} ${event.title}`}
                    >
                      {event.state === 'todo' && <span className="mr-1 text-red-600">●</span>}
                      {event.title}
                    </Link>
                  )
                })}
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">現在の対応状況</h2>
          <div className="space-y-4">
            {DISPLAY_ORDER.map(state => {
              const stateRows = grouped[state]
              if (stateRows.length === 0) return null
              const meta = COMPANY_DISPLAY_META[state]
              return (
                <details key={state} className="min-w-0" open={['action_required', 'awaiting_result', 'scheduled'].includes(state)}>
                  <summary className="min-w-0 cursor-pointer list-none rounded-lg border bg-card px-3 py-2">
                    <span className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-sm font-medium">{stateRows.length}社</span>
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{meta.description}</span>
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {stateRows.map(row => (
                      <ProcessLine
                        key={row.company.id}
                        company={row.company}
                        processName={row.primary?.name ?? 'プロセス未登録'}
                        detail={
                          row.currentStep
                            ? `${row.currentStep.label}・${STEP_STATE_META[row.currentStep.state].label}`
                            : row.primary
                              ? PROCESS_RESULT_META[row.primary.result].label
                              : '応募検討'
                        }
                      />
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">業界別</h2>
          <div className="space-y-2">
            {categories.map(category => {
              const categoryRows = rows.filter(row => row.company.category === category.id)
              if (categoryRows.length === 0) return null
              return (
                <div key={category.id} className="rounded-lg border bg-card px-3 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="font-medium">{category.label}</span>
                    <Badge variant="secondary">{categoryRows.length}社</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DISPLAY_ORDER.map(state => {
                      const count = categoryRows.filter(row => row.displayState === state).length
                      if (!count) return null
                      return (
                        <span key={state} className="rounded-full bg-muted px-2 py-1 text-xs">
                          {COMPANY_DISPLAY_META[state].label} {count}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 text-right">
        <Link href="/calendar" className="text-sm text-primary hover:underline">
          カレンダーで予定を確認 →
        </Link>
      </div>
    </div>
  )
}
