'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Grid2X2, List, Search } from 'lucide-react'
import AddCategoryDialog from './AddCategoryDialog'
import AddCompanyDialog from './AddCompanyDialog'
import DeleteCategoryButton from './DeleteCategoryButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryDef, Company, InternEvent, SelectionProcess } from '@/types'
import {
  COMPANY_DISPLAY_META,
  CompanyDisplayState,
  PROCESS_RESULT_META,
  STEP_STATE_META,
  TRACKING_STATE_META,
  deriveCompanyDisplayState,
  getCurrentStep,
  getPrimaryProcess,
  getTrackingState,
} from '@/lib/status'

interface Props {
  companies: Company[]
  events: InternEvent[]
  categories: CategoryDef[]
  processes: SelectionProcess[]
}

type FilterState = 'all' | CompanyDisplayState | 'hold' | 'archived'
type ViewMode = 'table' | 'cards'

const FILTER_OPTIONS: Array<{ value: FilterState; label: string }> = [
  { value: 'all', label: '全状態' },
  { value: 'action_required', label: '要対応' },
  { value: 'scheduled', label: '予定あり' },
  { value: 'awaiting_result', label: '結果待ち' },
  { value: 'active', label: '進行中' },
  { value: 'accepted', label: '参加確定' },
  { value: 'offered', label: '内定' },
  { value: 'considering', label: '応募検討' },
  { value: 'completed', label: '完了' },
  { value: 'hold', label: '保留' },
  { value: 'archived', label: '終了' },
]

function isFilterState(value: string | null): value is FilterState {
  return FILTER_OPTIONS.some(option => option.value === value)
}

function formatWhen(value: string) {
  const [date, time] = value.split('T')
  return time ? `${date} ${time.slice(0, 5)}` : date
}

export default function CompaniesClient({ companies, events, categories, processes }: Props) {
  const searchParams = useSearchParams()
  const initial = searchParams.get('status')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState<FilterState>(isFilterState(initial) ? initial : 'all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  )

  const rows = useMemo(() => companies.map(company => {
    const companyProcesses = processes.filter(process => process.companyId === company.id)
    const primary = getPrimaryProcess(company, companyProcesses)
    const currentStep = getCurrentStep(primary)
    const trackingState = getTrackingState(company)
    const displayState = deriveCompanyDisplayState(company, companyProcesses)
    const nextEvent = events
      .filter(event =>
        event.companyId === company.id &&
        event.state !== 'done' &&
        event.state !== 'cancelled' &&
        new Date(event.start) >= new Date()
      )
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]
    return {
      company,
      companyProcesses,
      primary,
      currentStep,
      trackingState,
      displayState,
      nextEvent,
    }
  }), [companies, events, processes])

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const categoryOrder = new Map(categories.map((category, index) => [category.id, index]))
    return rows
      .filter(row => {
        if (categoryFilter !== 'all' && row.company.category !== categoryFilter) return false
        if (stateFilter === 'hold' || stateFilter === 'archived') {
          if (row.trackingState !== stateFilter) return false
        } else if (stateFilter !== 'all') {
          if (row.trackingState !== 'active' || row.displayState !== stateFilter) return false
        }
        if (!normalizedQuery) return true
        return `${row.company.name} ${row.primary?.name ?? ''} ${row.currentStep?.label ?? ''}`
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((a, b) => {
        const trackingOrder = { active: 0, hold: 1, archived: 2 }
        const trackingDiff = trackingOrder[a.trackingState] - trackingOrder[b.trackingState]
        if (trackingDiff !== 0) return trackingDiff
        const categoryDiff =
          (categoryOrder.get(a.company.category) ?? 999) -
          (categoryOrder.get(b.company.category) ?? 999)
        return categoryDiff || a.company.name.localeCompare(b.company.name, 'ja')
      })
  }, [rows, categories, query, categoryFilter, stateFilter])

  const activeRows = rows.filter(row => row.trackingState === 'active')
  const stats = [
    { label: '追跡中', value: activeRows.length },
    { label: '要対応', value: activeRows.filter(row => row.displayState === 'action_required').length },
    { label: '結果待ち', value: activeRows.filter(row => row.displayState === 'awaiting_result').length },
    { label: '保留', value: rows.filter(row => row.trackingState === 'hold').length },
  ]

  const StateBadge = ({ row }: { row: (typeof rows)[number] }) => {
    if (row.trackingState !== 'active') {
      return <Badge variant="secondary">{TRACKING_STATE_META[row.trackingState].label}</Badge>
    }
    const meta = COMPANY_DISPLAY_META[row.displayState]
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${meta.badge}`}>{meta.label}</span>
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">企業一覧</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {companies.length}社・{processes.length}選考プロセス
          </p>
        </div>
        <div className="flex gap-2">
          <AddCategoryDialog categories={categories} />
          <AddCompanyDialog categories={categories} companies={companies} />
        </div>
      </div>

      <div className="mb-5 grid gap-2 grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-lg border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="text-xl font-bold">{stat.value}<span className="ml-1 text-xs font-normal">社</span></div>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-lg border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_170px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="企業・プロセス・現在ステップで検索"
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={value => setCategoryFilter(value ?? 'all')}>
            <SelectTrigger>
              <SelectValue>
                {categoryFilter === 'all'
                  ? '全業界'
                  : categoryMap.get(categoryFilter)?.label ?? categoryFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全業界</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={value => setStateFilter((value ?? 'all') as FilterState)}>
            <SelectTrigger>
              <SelectValue>{FILTER_OPTIONS.find(option => option.value === stateFilter)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              title="表で表示"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              title="カードで表示"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          条件に一致する企業はありません。
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map(row => (
            <Link
              key={row.company.id}
              href={`/companies/${row.company.id}`}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="mb-3 flex items-start gap-2">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: row.company.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{row.company.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {categoryMap.get(row.company.category)?.label ?? row.company.category}
                  </div>
                </div>
                <StateBadge row={row} />
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">主プロセス</div>
                  <div className="truncate">{row.primary?.name ?? '未登録'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">現在ステップ</div>
                  <div className="truncate">
                    {row.currentStep
                      ? `${row.currentStep.label} · ${STEP_STATE_META[row.currentStep.state].label}`
                      : 'なし'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.companyProcesses
                    .filter(process => process.result !== 'none')
                    .map(process => (
                      <Badge key={process.id} variant="outline">
                        {process.name}: {PROCESS_RESULT_META[process.result].label}
                      </Badge>
                    ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">企業</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">主プロセス</th>
                <th className="px-3 py-2">現在ステップ</th>
                <th className="px-3 py-2">結果</th>
                <th className="px-3 py-2">次の予定</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map(row => (
                <tr key={row.company.id} className="hover:bg-accent/30">
                  <td className="px-3 py-2">
                    <Link href={`/companies/${row.company.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.company.color }} />
                      {row.company.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {categoryMap.get(row.company.category)?.label ?? row.company.category}
                    </div>
                  </td>
                  <td className="px-3 py-2"><StateBadge row={row} /></td>
                  <td className="px-3 py-2">
                    <div className="max-w-52 truncate">{row.primary?.name ?? '未登録'}</div>
                  </td>
                  <td className="px-3 py-2">
                    {row.currentStep ? (
                      <>
                        <div className="max-w-52 truncate">{row.currentStep.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {STEP_STATE_META[row.currentStep.state].label}
                        </div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.primary ? PROCESS_RESULT_META[row.primary.result].label : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.nextEvent ? (
                      <>
                        <div className="max-w-52 truncate">{row.nextEvent.title}</div>
                        <div className="text-xs text-muted-foreground">{formatWhen(row.nextEvent.start)}</div>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">カテゴリ管理</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => {
            const count = companies.filter(company => company.category === category.id).length
            return (
              <div key={category.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="text-sm">{category.label}</span>
                <Badge variant="secondary">{count}社</Badge>
                <DeleteCategoryButton id={category.id} label={category.label} disabled={count > 0} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
