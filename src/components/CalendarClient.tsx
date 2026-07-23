'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid/index.js'
import interactionPlugin from '@fullcalendar/interaction/index.js'
import listPlugin from '@fullcalendar/list/index.js'
import { EventClickArg, EventContentArg } from '@fullcalendar/core/index.js'
import { DateClickArg } from '@fullcalendar/interaction/index.js'
import {
  CalendarItemState,
  Company,
  CategoryDef,
  EventType,
  InternEvent,
  SelectionProcess,
} from '@/types'
import { addEvent, updateEventState, deleteEvent, updateEvent } from '@/lib/actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Link from 'next/link'

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

interface Props {
  events: CalendarEvent[]
  companies: Company[]
  categories: CategoryDef[]
  processes: SelectionProcess[]
}

const STATE_LABELS: Record<CalendarItemState, string> = {
  todo: '要対応',
  scheduled: '予定',
  done: '完了',
  cancelled: '中止',
}


function OverlapWarning({ internships }: { internships: CalendarEvent[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-yellow-400 bg-yellow-50 text-xs text-yellow-800">
      <button
        className="w-full flex items-center justify-between px-2 py-1.5 font-semibold"
        onClick={() => setOpen(v => !v)}
      >
        <span>⚠ 日程重複あり（{internships.length}件）</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-2 pb-2 space-y-1 border-t border-yellow-300">
          {internships.map(e => (
            <li key={e.id} className="pt-1">
              <div className="font-semibold">{e.extendedProps.company.name}</div>
              <div className="text-yellow-700 leading-tight">{e.title}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EventContent({ arg }: { arg: EventContentArg }) {
  const { event } = arg.event.extendedProps as { event: InternEvent; company: Company }
  const isDeadline = event.type === 'deadline'
  const isPast = new Date(event.start) < new Date()

  if (isDeadline) {
    return (
      <div
        className="flex items-center gap-0.5 px-1 py-0.5 rounded overflow-hidden w-full"
        style={{
          backgroundColor: arg.event.backgroundColor + (isPast ? '60' : 'cc'),
          color: '#fff',
        }}
      >
        <span className="text-xs flex-shrink-0">⚠</span>
        <span className="text-xs truncate font-medium">{arg.event.title}</span>
      </div>
    )
  }

  return (
    <div
      className="px-1 py-0.5 rounded overflow-hidden w-full"
      style={{
        backgroundColor: arg.event.backgroundColor + (isPast ? '60' : 'cc'),
        color: '#fff',
      }}
    >
      <span className="text-xs truncate block font-medium">{arg.event.title}</span>
    </div>
  )
}

const TYPE_LABELS: Record<EventType, string> = {
  deadline: '締切',
  internship: 'インターン',
  selection: '選考',
  event: 'イベント',
}

const EMPTY_FORM = {
  companyId: '',
  title: '',
  type: 'deadline' as EventType,
  start: '',
  end: '',
  allDay: false,
  state: 'todo' as CalendarItemState,
  processId: '',
  stepId: '',
  note: '',
}

const toDateValue = (s: string) => (s ? s.split('T')[0] : '')

const toDateTimeValue = (s: string) => {
  if (!s) return ''
  if (s.includes('T')) return s.substring(0, 16)
  return `${s}T09:00`
}

const formatEventDate = (s: string) => {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...(s.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export default function CalendarClient({ events, companies, categories, processes }: Props) {
  const categoryLabels = Object.fromEntries(categories.map(c => [c.id, c.label]))
  const router = useRouter()
  const calendarRef = useRef<FullCalendar>(null)
  const [selectedEvent, setSelectedEvent] = useState<{
    event: InternEvent
    company: Company
  } | null>(null)
  const [currentState, setCurrentState] = useState<CalendarItemState>('todo')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', type: 'deadline' as EventType, start: '', end: '', allDay: true })
  const [view, setView] = useState<'dayGridMonth' | 'listMonth'>('dayGridMonth')

  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(
    () => new Set(companies.map(c => c.id))
  )
  const [deadlineOpen, setDeadlineOpen] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleCompanySelection = (id: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllCompanies = () => {
    setSelectedCompanies(new Set(companies.map(c => c.id)))
  }

  const clearSelectedCompanies = () => {
    setSelectedCompanies(new Set())
  }

  const handleDateClick = useCallback((arg: DateClickArg) => {
    const allDay = !arg.dateStr.includes('T')
    setForm({ ...EMPTY_FORM, start: arg.dateStr, end: arg.dateStr, allDay })
    setAddOpen(true)
  }, [])

  const handleAddSave = async () => {
    if (!form.companyId || !form.title || !form.start) return
    setAdding(true)
    try {
      await addEvent({
        companyId: form.companyId,
        title: form.title,
        type: form.type,
        start: form.start,
        end: form.end || form.start,
        state: form.state,
        note: form.note,
        processId: form.processId || undefined,
        stepId: form.stepId || undefined,
      })
      setAddOpen(false)
      setForm(EMPTY_FORM)
      router.refresh()
    } finally {
      setAdding(false)
    }
  }

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const { event: internEvent, company } = arg.event.extendedProps as {
      event: InternEvent
      company: Company
    }
    setSelectedEvent({ event: internEvent, company })
    setCurrentState(internEvent.state)
    setEditMode(false)
  }, [])

  const handleStateSave = async () => {
    if (!selectedEvent) return
    setSaving(true)
    try {
      await updateEventState(selectedEvent.event.id, currentState)
      setSelectedEvent(prev =>
        prev ? { ...prev, event: { ...prev.event, state: currentState } } : null
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedEvent) return
    setDeleting(true)
    try {
      await deleteEvent(selectedEvent.event.id)
      setSelectedEvent(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const handleEditOpen = () => {
    if (!selectedEvent) return
    setEditForm({
      title: selectedEvent.event.title,
      type: selectedEvent.event.type,
      start: selectedEvent.event.start,
      end: selectedEvent.event.end,
      allDay: !selectedEvent.event.start.includes('T'),
    })
    setEditMode(true)
  }

  const handleEditSave = async () => {
    if (!selectedEvent) return
    setSaving(true)
    try {
      await updateEvent(selectedEvent.event.id, {
        title: editForm.title,
        type: editForm.type,
        start: editForm.start,
        end: editForm.end || editForm.start,
        state: currentState,
      })
      setSelectedEvent(prev =>
        prev ? { ...prev, event: { ...prev.event, ...editForm, end: editForm.end || editForm.start, state: currentState } } : null
      )
      setEditMode(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const switchView = (v: 'dayGridMonth' | 'listMonth') => {
    setView(v)
    calendarRef.current?.getApi().changeView(v)
  }

  const visibleEvents = events.filter(e => selectedCompanies.has(e.extendedProps.event.companyId))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const upcomingDeadlines = visibleEvents
    .filter(e =>
      e.extendedProps.event.type === 'deadline' &&
      e.extendedProps.event.state === 'todo' &&
      new Date(e.extendedProps.event.start) >= today
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // Detect overlapping internships
  const internships = visibleEvents.filter(e => e.extendedProps.event.type === 'internship')
  const overlaps = new Set<string>()
  for (let i = 0; i < internships.length; i++) {
    for (let j = i + 1; j < internships.length; j++) {
      const a = internships[i]
      const b = internships[j]
      const aStart = new Date(a.start)
      const aEnd = new Date(a.end)
      const bStart = new Date(b.start)
      const bEnd = new Date(b.end)
      if (aStart < bEnd && aEnd > bStart) {
        overlaps.add(a.id)
        overlaps.add(b.id)
      }
    }
  }

  const sidebarContent = (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">企業</h2>
            <span className="text-xs text-muted-foreground">{selectedCompanies.size}/{companies.length}社表示</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="outline"
              size="xs"
              className="h-7 text-xs"
              onClick={selectAllCompanies}
              disabled={selectedCompanies.size === companies.length}
            >
              全選択
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-7 text-xs"
              onClick={clearSelectedCompanies}
              disabled={selectedCompanies.size === 0}
            >
              全解除
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {categories.map(category => {
            const categoryCompanies = companies.filter(c => c.category === category.id)
            if (categoryCompanies.length === 0) return null
            const selectedCount = categoryCompanies.filter(c => selectedCompanies.has(c.id)).length

            return (
              <details key={category.id} className="group rounded-lg border bg-card">
                <summary className="flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-muted/60">
                  <span className="inline-block text-xs transition-transform group-open:rotate-90">▶</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="min-w-0 flex-1 truncate">{category.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {selectedCount}/{categoryCompanies.length}
                  </span>
                </summary>
                <ul className="space-y-0.5 border-t p-1">
                  {categoryCompanies.map(c => {
                    const selected = selectedCompanies.has(c.id)
                    return (
                      <li key={c.id} className={`rounded-md ${selected ? 'bg-primary/10' : ''}`}>
                        <button
                          onClick={() => toggleCompanySelection(c.id)}
                          className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                          title={selected ? 'カレンダーから非表示' : 'カレンダーに表示'}
                        >
                          <span
                            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold text-white transition-colors"
                            style={{ backgroundColor: selected ? c.color : 'transparent', borderColor: c.color }}
                          >
                            {selected ? '✓' : ''}
                          </span>
                          <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>
                            {c.name}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )
          })}
        </div>
      </div>

      {upcomingDeadlines.length > 0 && (
        <div>
          <button
            onClick={() => setDeadlineOpen(v => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">直近の締切</h2>
            <span className="text-xs text-muted-foreground">{deadlineOpen ? '▲' : '▼'}</span>
          </button>
          {deadlineOpen && (
            <ul className="space-y-2">
              {upcomingDeadlines.slice(0, 12).map(e => {
                const days = daysUntil(e.start)
                const urgencyClass = days <= 3
                  ? 'text-red-600 font-bold'
                  : days <= 7
                  ? 'text-orange-500 font-semibold'
                  : 'text-muted-foreground'
                return (
                  <li key={e.id} className="flex items-start gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: e.backgroundColor }} />
                    <div className="min-w-0">
                      <div className={urgencyClass}>{days === 0 ? '今日' : `あと${days}日`}</div>
                      <div className="truncate text-foreground leading-tight">{e.title}</div>
                      <div className="truncate text-muted-foreground leading-tight">{e.extendedProps.company.name}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {overlaps.size > 0 && (
        <OverlapWarning internships={internships.filter(e => overlaps.has(e.id))} />
      )}
    </div>
  )

  return (
    <div className="flex gap-4 p-4 md:h-[calc(100vh-3.5rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Mobile: Sheet */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰ フィルター
          </Button>
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-72 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>フィルター</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setForm({ ...EMPTY_FORM }); setAddOpen(true) }}
              className="text-xs h-7"
            >
              ＋ 追加
            </Button>
            <Button
              size="sm"
              variant={view === 'dayGridMonth' ? 'default' : 'outline'}
              onClick={() => switchView('dayGridMonth')}
              className="text-xs h-7"
            >
              月表示
            </Button>
            <Button
              size="sm"
              variant={view === 'listMonth' ? 'default' : 'outline'}
              onClick={() => switchView('listMonth')}
              className="text-xs h-7"
            >
              リスト
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            initialDate={new Date().toISOString().split('T')[0]}
            locale="ja"
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            events={visibleEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={(arg) => <EventContent arg={arg} />}
            dayMaxEvents={4}
            moreLinkText={(n) => `+${n}件`}
            buttonText={{
              today: '今月',
              month: '月',
              list: 'リスト',
            }}
            listDayFormat={{ month: 'long', day: 'numeric', weekday: 'short' }}
            listDaySideFormat={false}
            noEventsText="イベントなし"
          />
        </div>
      </div>

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => { setSelectedEvent(null); setEditMode(false) }}>
        <DialogContent className="max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedEvent.company.color }}
                  />
                  {editMode ? (
                    <Input
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="h-7 text-base font-semibold"
                    />
                  ) : (
                    selectedEvent.event.title
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedEvent.company.name} - {TYPE_LABELS[selectedEvent.event.type]}
                </DialogDescription>
                <div className="space-y-3 pt-1">
                  {editMode ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">種別</label>
                        <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v as EventType }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editForm.allDay}
                          onChange={e => {
                            const allDay = e.target.checked
                            setEditForm(f => ({
                              ...f,
                              allDay,
                              start: allDay ? toDateValue(f.start) : toDateTimeValue(f.start),
                              end: allDay ? toDateValue(f.end) : toDateTimeValue(f.end),
                            }))
                          }}
                          className="h-3.5 w-3.5"
                        />
                        終日（時刻を指定しない）
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">{editForm.allDay ? '開始日' : '開始日時'}</label>
                          <Input
                            type={editForm.allDay ? 'date' : 'datetime-local'}
                            value={editForm.allDay ? toDateValue(editForm.start) : toDateTimeValue(editForm.start)}
                            onChange={e => setEditForm(f => ({ ...f, start: e.target.value }))}
                          />
                        </div>
                        {editForm.type !== 'deadline' && (
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">{editForm.allDay ? '終了日' : '終了日時'}</label>
                            <Input
                              type={editForm.allDay ? 'date' : 'datetime-local'}
                              value={editForm.allDay ? toDateValue(editForm.end) : toDateTimeValue(editForm.end)}
                              onChange={e => setEditForm(f => ({ ...f, end: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{selectedEvent.company.name}</Badge>
                        <Badge variant="outline">{categoryLabels[selectedEvent.company.category] ?? selectedEvent.company.category}</Badge>
                        <Badge variant="outline">{TYPE_LABELS[selectedEvent.event.type]}</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-16">開始</span>
                          <span className="font-medium">{formatEventDate(selectedEvent.event.start)}</span>
                        </div>
                        {selectedEvent.event.end && selectedEvent.event.end !== selectedEvent.event.start && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-16">終了</span>
                            <span className="font-medium">{formatEventDate(selectedEvent.event.end)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">予定の状態</label>
                    <Select value={currentState} onValueChange={(v) => setCurrentState(v as CalendarItemState)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{STATE_LABELS[currentState]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STATE_LABELS) as [CalendarItemState, string][]).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editMode ? (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} disabled={saving}>
                        キャンセル
                      </Button>
                      <Button size="sm" onClick={handleEditSave} disabled={saving || !editForm.title || !editForm.start}>
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center pt-1">
                      <Link
                        href={`/companies/${selectedEvent.company.id}`}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                        onClick={() => setSelectedEvent(null)}
                      >
                        企業詳細を見る →
                      </Link>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleEditOpen} disabled={deleting}>
                          編集
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting || saving}>
                          {deleting ? '削除中...' : '削除'}
                        </Button>
                        <Button size="sm" onClick={handleStateSave} disabled={saving || deleting}>
                          {saving ? '保存中...' : '保存'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add event dialog */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) setForm(EMPTY_FORM) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>イベントを追加</DialogTitle>
            <DialogDescription>カレンダーに新しいイベントを追加します</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">企業</Label>
              <Select
                value={form.companyId}
                onValueChange={v => setForm(f => ({
                  ...f,
                  companyId: v ?? '',
                  processId: '',
                  stepId: '',
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選択..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id ?? ''}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">タイトル</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例：ES締切、書類選考..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">種別</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as EventType }))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{STATE_LABELS[form.state]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={e => {
                  const allDay = e.target.checked
                  setForm(f => ({
                    ...f,
                    allDay,
                    start: allDay ? toDateValue(f.start) : toDateTimeValue(f.start),
                    end: allDay ? toDateValue(f.end) : toDateTimeValue(f.end),
                  }))
                }}
                className="h-3.5 w-3.5"
              />
              終日（時刻を指定しない）
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{form.allDay ? '開始日' : '開始日時'}</Label>
                <Input
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.allDay ? toDateValue(form.start) : toDateTimeValue(form.start)}
                  onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                />
              </div>
              {form.type !== 'deadline' && (
                <div className="space-y-1">
                  <Label className="text-xs">{form.allDay ? '終了日' : '終了日時'}</Label>
                  <Input
                    type={form.allDay ? 'date' : 'datetime-local'}
                    value={form.allDay ? toDateValue(form.end) : toDateTimeValue(form.end)}
                    onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">予定の状態</Label>
              <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v as CalendarItemState }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATE_LABELS) as [CalendarItemState, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {processes.some(process => process.companyId === form.companyId) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">選考プロセス</Label>
                  <Select
                    value={form.processId}
                    onValueChange={value => setForm(current => ({
                      ...current,
                      processId: value ?? '',
                      stepId: '',
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="紐づけなし">
                        {processes.find(process => process.id === form.processId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {processes
                        .filter(process => process.companyId === form.companyId)
                        .map(process => (
                          <SelectItem key={process.id} value={process.id}>{process.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">選考ステップ</Label>
                  <Select
                    value={form.stepId}
                    onValueChange={value => setForm(current => ({ ...current, stepId: value ?? '' }))}
                    disabled={!form.processId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="紐づけなし">
                        {processes
                          .find(process => process.id === form.processId)
                          ?.steps.find(step => step.id === form.stepId)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {processes
                        .find(process => process.id === form.processId)
                        ?.steps.map(step => (
                          <SelectItem key={step.id} value={step.id}>{step.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)} disabled={adding}>
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAddSave}
                disabled={adding || !form.companyId || !form.title || !form.start}
              >
                {adding ? '保存中...' : '追加'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
