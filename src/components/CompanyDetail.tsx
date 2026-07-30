'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  addSelectionProcess,
  addSelectionStep,
  deleteCompany,
  deleteEvent,
  deleteSelectionProcess,
  deleteSelectionStep,
  moveSelectionStep,
  reorderSelectionStep,
  setCurrentStep,
  setPrimaryProcess,
  updateCompanyAccount,
  updateCompanyNotes,
  updateCompanyTrackingState,
  updateEventState,
  updateSelectionProcess,
  updateSelectionStep,
} from '@/lib/actions'
import { CompanyFile } from '@/lib/data'
import {
  PROCESS_KIND_META,
  PROCESS_RESULT_META,
  PROCESS_STATUS_META,
  STEP_KIND_META,
  STEP_RESULT_META,
  STEP_STATE_META,
  TRACKING_STATE_META,
  getTrackingState,
} from '@/lib/status'
import {
  CalendarItemState,
  Company,
  InternEvent,
  ProcessKind,
  ProcessResult,
  ProcessStatus,
  SelectionProcess,
  StepKind,
  StepResult,
  StepState,
  TrackingState,
} from '@/types'

const FILE_ICONS: Record<string, string> = {
  md: '📝',
  pdf: '📄',
  xlsx: '📊',
  xls: '📊',
  pptx: '📊',
  ppt: '📊',
}

const CALENDAR_STATE_META: Record<CalendarItemState, { label: string }> = {
  todo: { label: '要対応' },
  scheduled: { label: '予定' },
  done: { label: '完了' },
  cancelled: { label: '中止' },
}

const TYPE_LABELS: Record<InternEvent['type'], string> = {
  deadline: '締切',
  internship: 'インターン',
  selection: '選考',
  event: 'イベント',
}

interface Props {
  company: Company
  events: InternEvent[]
  processes: SelectionProcess[]
  files: CompanyFile[]
}

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...(value.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export default function CompanyDetail({ company, events, processes, files }: Props) {
  const router = useRouter()
  const [processList, setProcessList] = useState(processes)
  const [eventList, setEventList] = useState(events)
  const [busy, setBusy] = useState(false)
  const [processDialogOpen, setProcessDialogOpen] = useState(false)
  const [processForm, setProcessForm] = useState({
    name: '',
    kind: 'internship' as ProcessKind,
  })

  const [accountEdit, setAccountEdit] = useState(false)
  const [officialUrl, setOfficialUrl] = useState(company.url ?? '')
  const [mypageUrl, setMypageUrl] = useState(company.mypageUrl ?? '')
  const [loginId, setLoginId] = useState(company.loginId ?? '')
  const [webTestType, setWebTestType] = useState(company.webTestType ?? '')
  const [password, setPassword] = useState(company.password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'loginId' | 'password' | null>(null)

  const [notes, setNotes] = useState(company.notes)
  const [notesDraft, setNotesDraft] = useState(company.notes)
  const [notesEdit, setNotesEdit] = useState(false)

  useEffect(() => setProcessList(processes), [processes])
  useEffect(() => setEventList(events), [events])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const copy = async (value: string, key: 'loginId' | 'password') => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(current => current === key ? null : current), 1500)
  }

  const handleAddProcess = () => {
    if (!processForm.name.trim()) return
    run(async () => {
      await addSelectionProcess(company.id, {
        name: processForm.name,
        kind: processForm.kind,
      })
      setProcessDialogOpen(false)
      setProcessForm({ name: '', kind: 'internship' })
    })
  }

  const handleDeleteCompany = () => {
    if (!window.confirm(`「${company.name}」と関連データ、企業フォルダを削除します。よろしいですか？`)) return
    run(async () => {
      await deleteCompany(company.id)
      router.push('/companies')
    })
  }

  const trackingState = getTrackingState(company)

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: company.color }} />
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{company.name}</h1>
        <Select
          value={trackingState}
          onValueChange={value => run(() => updateCompanyTrackingState(company.id, value as TrackingState))}
          disabled={busy}
        >
          <SelectTrigger className="w-32"><SelectValue>{TRACKING_STATE_META[trackingState].label}</SelectValue></SelectTrigger>
          <SelectContent>
            {(Object.entries(TRACKING_STATE_META) as [TrackingState, { label: string }][]).map(([value, meta]) => (
              <SelectItem key={value} value={value}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={handleDeleteCompany} disabled={busy} title="企業を削除">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <section className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">アカウント情報</h2>
            <p className="text-xs text-muted-foreground">企業サイトとログイン情報</p>
          </div>
          {!accountEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setAccountEdit(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />編集
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setAccountEdit(false)} disabled={busy}>キャンセル</Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(async () => {
                  await updateCompanyAccount(company.id, mypageUrl, loginId, officialUrl, webTestType, password)
                  setAccountEdit(false)
                })}
              >
                保存
              </Button>
            </div>
          )}
        </div>

        {accountEdit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>マイページURL</Label><Input value={mypageUrl} onChange={event => setMypageUrl(event.target.value)} /></div>
            <div><Label>公式サイトURL</Label><Input value={officialUrl} onChange={event => setOfficialUrl(event.target.value)} /></div>
            <div><Label>ログインID</Label><Input value={loginId} onChange={event => setLoginId(event.target.value)} /></div>
            <div><Label>パスワード</Label><Input value={password} onChange={event => setPassword(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Webテスト種別</Label><Input value={webTestType} onChange={event => setWebTestType(event.target.value)} /></div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-4">
            {mypageUrl ? (
              <a href={mypageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground">
                マイページ <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : <Button variant="outline" disabled>マイページ未設定</Button>}
            <Button variant="outline" onClick={() => copy(loginId, 'loginId')} disabled={!loginId}>
              {copiedKey === 'loginId' ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}ID
            </Button>
            <Button variant="outline" onClick={() => copy(password, 'password')} disabled={!password}>
              {copiedKey === 'password' ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}PW
            </Button>
            {officialUrl ? (
              <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-1 rounded-md border px-3 text-sm">
                公式サイト <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : <Button variant="outline" disabled>公式サイト未設定</Button>}
            {(loginId || password || webTestType) && (
              <div className="sm:col-span-4 rounded-md bg-muted/40 p-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><span className="text-muted-foreground">ID</span><div className="font-mono">{loginId || '—'}</div></div>
                  <div>
                    <span className="text-muted-foreground">パスワード</span>
                    <div className="flex items-center gap-2 font-mono">
                      {password ? (showPassword ? password : '••••••••') : '—'}
                      {password && (
                        <button onClick={() => setShowPassword(value => !value)} title={showPassword ? '隠す' : '表示'}>
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div><span className="text-muted-foreground">Webテスト</span><div>{webTestType || '—'}</div></div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Tabs defaultValue="processes">
        <TabsList>
          <TabsTrigger value="processes">選考プロセス ({processList.length})</TabsTrigger>
          <TabsTrigger value="events">予定 ({eventList.length})</TabsTrigger>
          <TabsTrigger value="notes">メモ</TabsTrigger>
          <TabsTrigger value="files">ファイル ({files.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="processes" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">選考プロセス</h2>
              <p className="text-xs text-muted-foreground">会社ごとに自由なフローを作成し、主プロセスを1つ指定します。</p>
            </div>
            <Button size="sm" onClick={() => setProcessDialogOpen(true)}>＋ プロセスを追加</Button>
          </div>
          {processList.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              選考プロセスがありません。「プロセスを追加」から登録してください。
            </div>
          ) : (
            <div className="space-y-4">
              {processList.map(process => (
                <ProcessCard
                  key={process.id}
                  company={company}
                  process={process}
                  allProcesses={processList}
                  busy={busy}
                  run={run}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <div className="mb-3">
            <h2 className="font-semibold">カレンダー予定</h2>
            <p className="text-xs text-muted-foreground">予定の状態だけを管理します。選考結果はプロセス・ステップ側で管理します。</p>
          </div>
          <div className="space-y-2">
            {eventList.map(event => {
              const process = processList.find(item => item.id === event.processId)
              const step = process?.steps.find(item => item.id === event.stepId)
              return (
                <div key={event.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                  <div className="sm:w-44">
                    <div className="text-sm font-medium">{formatDate(event.start)}</div>
                    {event.end !== event.start && <div className="text-xs text-muted-foreground">〜 {formatDate(event.end)}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{event.title}</span>
                      <Badge variant="outline">{TYPE_LABELS[event.type]}</Badge>
                    </div>
                    {(process || step) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {process?.name}{step ? ` / ${step.label}` : ''}
                      </div>
                    )}
                  </div>
                  <Select
                    value={event.state}
                    onValueChange={value => {
                      const state = value as CalendarItemState
                      setEventList(current => current.map(item => item.id === event.id ? { ...item, state } : item))
                      run(() => updateEventState(event.id, state))
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger className="w-full sm:w-28"><SelectValue>{CALENDAR_STATE_META[event.state].label}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CALENDAR_STATE_META) as [CalendarItemState, { label: string }][]).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`予定「${event.title}」を削除しますか？`)) return
                      setEventList(current => current.filter(item => item.id !== event.id))
                      run(() => deleteEvent(event.id))
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">企業メモ</h2>
            {!notesEdit && <Button variant="outline" size="sm" onClick={() => setNotesEdit(true)}>編集</Button>}
          </div>
          {notesEdit ? (
            <div className="space-y-3">
              <Textarea value={notesDraft} onChange={event => setNotesDraft(event.target.value)} className="min-h-96 font-mono" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setNotesDraft(notes); setNotesEdit(false) }}>キャンセル</Button>
                <Button onClick={() => run(async () => { await updateCompanyNotes(company.id, notesDraft); setNotes(notesDraft); setNotesEdit(false) })}>保存</Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none rounded-lg border bg-card p-5">
              {notes ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown> : <p className="text-muted-foreground">メモはありません。</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map(file => (
              <a
                key={file.relativePath}
                href={`/api/open?path=${encodeURIComponent(file.relativePath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/40"
              >
                <span className="text-xl">{FILE_ICONS[file.ext] ?? '📎'}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
            {files.length === 0 && <p className="text-sm text-muted-foreground">ファイルはありません。</p>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>選考プロセスを追加</DialogTitle>
            <DialogDescription>サマーインターン、早期選考、本選考などを個別に管理します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>名称</Label><Input value={processForm.name} onChange={event => setProcessForm(form => ({ ...form, name: event.target.value }))} placeholder="例：早期選考" /></div>
            <div>
              <Label>種類</Label>
              <Select value={processForm.kind} onValueChange={value => setProcessForm(form => ({ ...form, kind: value as ProcessKind }))}>
                <SelectTrigger><SelectValue>{PROCESS_KIND_META[processForm.kind].label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROCESS_KIND_META) as [ProcessKind, { label: string }][]).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setProcessDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleAddProcess} disabled={!processForm.name.trim() || busy}>追加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProcessCard({
  company,
  process,
  allProcesses,
  busy,
  run,
}: {
  company: Company
  process: SelectionProcess
  allProcesses: SelectionProcess[]
  busy: boolean
  run: (action: () => Promise<unknown>) => Promise<void>
}) {
  const [name, setName] = useState(process.name)
  const [kind, setKind] = useState(process.kind)
  const [status, setStatus] = useState(process.status)
  const [result, setResult] = useState(process.result)
  const [stepLabel, setStepLabel] = useState('')
  const [stepKind, setStepKind] = useState<StepKind>('other')

  useEffect(() => {
    setName(process.name)
    setKind(process.kind)
    setStatus(process.status)
    setResult(process.result)
  }, [process])

  const isPrimary = company.primaryProcessId === process.id
  const sortedSteps = [...process.steps].sort((a, b) => a.order - b.order)

  return (
    <section className={`rounded-lg border bg-card ${isPrimary ? 'ring-2 ring-primary/30' : ''}`}>
      <div className="border-b p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {isPrimary && <Badge><Star className="mr-1 h-3 w-3 fill-current" />主プロセス</Badge>}
          <Input value={name} onChange={event => setName(event.target.value)} className="min-w-48 flex-1 font-semibold" />
          {!isPrimary && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => setPrimaryProcess(company.id, process.id))}>
              <Star className="mr-1 h-3.5 w-3.5" />主に設定
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`プロセス「${process.name}」を削除しますか？予定は削除されません。`)) return
              run(() => deleteSelectionProcess(process.id))
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Select value={kind} onValueChange={value => setKind(value as ProcessKind)}>
            <SelectTrigger><SelectValue>{PROCESS_KIND_META[kind].label}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.entries(PROCESS_KIND_META) as [ProcessKind, { label: string }][]).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={value => setStatus(value as ProcessStatus)}>
            <SelectTrigger><SelectValue>{PROCESS_STATUS_META[status].label}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.entries(PROCESS_STATUS_META) as [ProcessStatus, { label: string }][]).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={value => setResult(value as ProcessResult)}>
            <SelectTrigger><SelectValue>{PROCESS_RESULT_META[result].label}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.entries(PROCESS_RESULT_META) as [ProcessResult, { label: string }][]).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || !name.trim()}
            onClick={() => run(() => updateSelectionProcess(process.id, { name, kind, status, result }))}
          >
            プロセスを保存
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">選考ステップ</h3>
          <span className="text-xs text-muted-foreground">{sortedSteps.length}ステップ</span>
        </div>
        {sortedSteps.length === 0 ? (
          <div className="mb-3 rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            ステップを追加してください。
          </div>
        ) : (
          <div className="mb-4 space-y-2">
            {sortedSteps.map((step, index) => {
              const current = process.currentStepId === step.id
              return (
                <div key={step.id} className={`rounded-lg border p-3 ${current ? 'border-primary bg-primary/5' : ''}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
                    <span className="min-w-32 flex-1 font-medium">{step.label}</span>
                    {current && <Badge>現在</Badge>}
                    {!current && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => setCurrentStep(process.id, step.id))}>
                        現在に設定
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={busy || index === 0} onClick={() => run(() => reorderSelectionStep(process.id, step.id, 'up'))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy || index === sortedSteps.length - 1} onClick={() => run(() => reorderSelectionStep(process.id, step.id, 'down'))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`ステップ「${step.label}」を削除しますか？`)) return
                        run(() => deleteSelectionStep(process.id, step.id))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Select
                      value={step.kind}
                      onValueChange={value => run(() => updateSelectionStep(process.id, step.id, { kind: value as StepKind }))}
                    >
                      <SelectTrigger><SelectValue>{STEP_KIND_META[step.kind].label}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STEP_KIND_META) as [StepKind, { label: string }][]).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={step.state}
                      onValueChange={value => run(() => updateSelectionStep(process.id, step.id, { state: value as StepState }))}
                    >
                      <SelectTrigger><SelectValue>{STEP_STATE_META[step.state].label}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STEP_STATE_META) as [StepState, { label: string }][]).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={step.result}
                      onValueChange={value => run(() => updateSelectionStep(process.id, step.id, { result: value as StepResult }))}
                    >
                      <SelectTrigger><SelectValue>{STEP_RESULT_META[step.result].label}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STEP_RESULT_META) as [StepResult, { label: string }][]).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {allProcesses.length > 1 ? (
                      <Select
                        value={process.id}
                        onValueChange={value => run(() => moveSelectionStep(company.id, process.id, step.id, value as string))}
                      >
                        <SelectTrigger><SelectValue>{process.name}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {allProcesses.map(target => (
                            <SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : <div className="flex items-center px-2 text-xs text-muted-foreground">移動先なし</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input value={stepLabel} onChange={event => setStepLabel(event.target.value)} placeholder="新しいステップ名（例：一次面接）" />
          <Select value={stepKind} onValueChange={value => setStepKind(value as StepKind)}>
            <SelectTrigger><SelectValue>{STEP_KIND_META[stepKind].label}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.entries(STEP_KIND_META) as [StepKind, { label: string }][]).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || !stepLabel.trim()}
            onClick={() => run(async () => {
              await addSelectionStep(process.id, { label: stepLabel, kind: stepKind })
              setStepLabel('')
              setStepKind('other')
            })}
          >
            ステップ追加
          </Button>
        </div>
      </div>
    </section>
  )
}
