export type Category = string
export type EventType = 'deadline' | 'internship' | 'selection' | 'event'
export type LegacyStatus =
  | 'pending'
  | 'applied'
  | 'in_progress'
  | 'passed'
  | 'rejected'
  | 'done'
  | 'confirmed'

export type TrackingState = 'active' | 'hold' | 'archived'
export type ProcessKind = 'internship' | 'early_selection' | 'main_selection' | 'event' | 'other'
export type ProcessStatus = 'considering' | 'active' | 'completed' | 'closed'
export type ProcessResult = 'none' | 'accepted' | 'offered' | 'rejected' | 'withdrawn'
export type StepKind =
  | 'entry'
  | 'document'
  | 'aptitude_test'
  | 'group_discussion'
  | 'interview'
  | 'internship'
  | 'offer'
  | 'other'
export type StepState =
  | 'not_started'
  | 'action_required'
  | 'scheduled'
  | 'submitted'
  | 'awaiting_result'
  | 'completed'
  | 'skipped'
  | 'cancelled'
export type StepResult = 'none' | 'passed' | 'failed' | 'accepted' | 'withdrawn'
export type CalendarItemState = 'todo' | 'scheduled' | 'done' | 'cancelled'

export interface CategoryDef {
  id: string
  label: string
  color: string
}

export interface Company {
  id: string
  name: string
  category: Category
  color: string
  notes: string
  url: string
  readmePath?: string
  mypageUrl?: string
  loginId?: string
  webTestType?: string
  password?: string
  suspended?: boolean
  trackingState?: TrackingState
  primaryProcessId?: string
}

export interface Settings {
  spiMypageUrl?: string
  spiTestCenterId?: string
  spiPassword?: string
}

export interface InternEvent {
  id: string
  companyId: string
  title: string
  type: EventType
  start: string
  end: string
  state: CalendarItemState
  note: string
  processId?: string
  stepId?: string
  legacyStatus?: LegacyStatus
}

export interface SelectionStep {
  id: string
  label: string
  kind: StepKind
  state: StepState
  result: StepResult
  order: number
}

export interface SelectionProcess {
  id: string
  companyId: string
  name: string
  kind: ProcessKind
  status: ProcessStatus
  result: ProcessResult
  currentStepId?: string
  steps: SelectionStep[]
  createdAt: string
  updatedAt: string
}
