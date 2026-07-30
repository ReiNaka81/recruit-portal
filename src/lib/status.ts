import {
  Company,
  ProcessKind,
  ProcessResult,
  ProcessStatus,
  SelectionProcess,
  StepKind,
  StepResult,
  StepState,
  TrackingState,
} from '@/types'

export const TRACKING_STATE_META: Record<TrackingState, { label: string; description: string }> = {
  active: { label: '追跡中', description: '現在も情報を追跡する企業' },
  hold: { label: '保留', description: 'いったん保留している企業' },
  archived: { label: '終了', description: '追跡を終了した企業' },
}

export const PROCESS_KIND_META: Record<ProcessKind, { label: string }> = {
  internship: { label: 'インターン' },
  early_selection: { label: '早期選考' },
  main_selection: { label: '本選考' },
  event: { label: 'イベント' },
  other: { label: 'その他' },
}

export const PROCESS_STATUS_META: Record<ProcessStatus, { label: string }> = {
  considering: { label: '応募検討' },
  active: { label: '進行中' },
  completed: { label: '完了' },
  closed: { label: '終了' },
}

export const PROCESS_RESULT_META: Record<ProcessResult, { label: string }> = {
  none: { label: '未確定' },
  accepted: { label: '参加確定' },
  offered: { label: '内定' },
  rejected: { label: '不合格' },
  withdrawn: { label: '辞退' },
}

export const STEP_KIND_META: Record<StepKind, { label: string }> = {
  entry: { label: 'エントリー' },
  document: { label: '書類' },
  aptitude_test: { label: '適性検査' },
  group_discussion: { label: 'GD' },
  interview: { label: '面接' },
  internship: { label: 'インターン' },
  offer: { label: 'オファー' },
  other: { label: 'その他' },
}

export const STEP_STATE_META: Record<StepState, { label: string }> = {
  not_started: { label: '未着手' },
  action_required: { label: '要対応' },
  scheduled: { label: '予定あり' },
  submitted: { label: '提出済み' },
  awaiting_result: { label: '結果待ち' },
  completed: { label: '完了' },
  skipped: { label: 'スキップ' },
  cancelled: { label: '中止' },
}

export const STEP_RESULT_META: Record<StepResult, { label: string }> = {
  none: { label: '未確定' },
  passed: { label: '通過' },
  failed: { label: '不合格' },
  accepted: { label: '参加確定' },
  withdrawn: { label: '辞退' },
}

export type CompanyDisplayState =
  | 'action_required'
  | 'scheduled'
  | 'awaiting_result'
  | 'active'
  | 'considering'
  | 'accepted'
  | 'offered'
  | 'completed'
  | 'hold'
  | 'archived'

export const COMPANY_DISPLAY_META: Record<CompanyDisplayState, {
  label: string
  description: string
  badge: string
}> = {
  action_required: {
    label: '要対応',
    description: '現在のステップに対応が必要',
    badge: 'bg-red-100 text-red-800 border-red-300',
  },
  scheduled: {
    label: '予定あり',
    description: '面接や参加予定が確定済み',
    badge: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  awaiting_result: {
    label: '結果待ち',
    description: '提出・選考結果を待っている',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  active: {
    label: '進行中',
    description: '選考プロセスが進行中',
    badge: 'bg-green-100 text-green-800 border-green-300',
  },
  considering: {
    label: '応募検討',
    description: '応募前またはプロセス未登録',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  accepted: {
    label: '参加確定',
    description: 'インターン等への参加が確定',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  offered: {
    label: '内定',
    description: '内定・オファー獲得',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  completed: {
    label: '完了',
    description: '主プロセスが完了・終了',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  hold: {
    label: '保留',
    description: '企業の追跡を一時保留',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  archived: {
    label: '終了',
    description: '企業の追跡を終了',
    badge: 'bg-gray-100 text-gray-600 border-gray-300',
  },
}

export function getTrackingState(company: Company): TrackingState {
  if (company.trackingState) return company.trackingState
  return company.suspended ? 'hold' : 'active'
}

export function getPrimaryProcess(
  company: Company,
  processes: SelectionProcess[]
): SelectionProcess | undefined {
  const companyProcesses = processes.filter(process => process.companyId === company.id)
  const explicit = company.primaryProcessId
    ? companyProcesses.find(process => process.id === company.primaryProcessId)
    : undefined
  if (explicit) return explicit

  return [...companyProcesses].sort((a, b) => {
    const activeDiff = Number(b.status === 'active') - Number(a.status === 'active')
    if (activeDiff !== 0) return activeDiff
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })[0]
}

export function getCurrentStep(process: SelectionProcess | undefined) {
  if (!process) return undefined
  return process.steps.find(step => step.id === process.currentStepId)
}

export function deriveCompanyDisplayState(
  company: Company,
  processes: SelectionProcess[]
): CompanyDisplayState {
  const tracking = getTrackingState(company)
  if (tracking === 'hold') return 'hold'
  if (tracking === 'archived') return 'archived'

  const process = getPrimaryProcess(company, processes)
  if (!process) return 'considering'
  const step = getCurrentStep(process)

  if (process.result === 'offered') return 'offered'
  if (step?.state === 'action_required') return 'action_required'
  if (step?.state === 'awaiting_result' || step?.state === 'submitted') return 'awaiting_result'
  if (step?.state === 'scheduled') return 'scheduled'
  if (process.status === 'active') return 'active'
  if (process.result === 'accepted') return 'accepted'
  if (process.status === 'considering') return 'considering'
  return 'completed'
}
