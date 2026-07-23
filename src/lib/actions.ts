'use server'

import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import {
  CalendarItemState,
  CategoryDef,
  Company,
  InternEvent,
  ProcessKind,
  ProcessResult,
  ProcessStatus,
  SelectionProcess,
  Settings,
  StepKind,
  StepResult,
  StepState,
  TrackingState,
} from '@/types'
import { encryptPassword } from './crypto'
import {
  assertSafeStorageId,
  resolveExistingRecruitPath,
  resolveRecruitPath,
} from './paths'

const dataDir = path.join(process.cwd(), 'src/data')
const companiesPath = path.join(dataDir, 'companies.json')
const eventsPath = path.join(dataDir, 'events.json')
const processesPath = path.join(dataDir, 'processes.json')

const EVENT_TYPES = new Set<InternEvent['type']>(['deadline', 'internship', 'selection', 'event'])
const EVENT_STATES = new Set<CalendarItemState>(['todo', 'scheduled', 'done', 'cancelled'])
const TRACKING_STATES = new Set<TrackingState>(['active', 'hold', 'archived'])
const PROCESS_KINDS = new Set<ProcessKind>(['internship', 'early_selection', 'main_selection', 'event', 'other'])
const PROCESS_STATUSES = new Set<ProcessStatus>(['considering', 'active', 'completed', 'closed'])
const PROCESS_RESULTS = new Set<ProcessResult>(['none', 'accepted', 'offered', 'rejected', 'withdrawn'])
const STEP_KINDS = new Set<StepKind>([
  'entry', 'document', 'aptitude_test', 'group_discussion', 'interview', 'internship', 'offer', 'other',
])
const STEP_STATES = new Set<StepState>([
  'not_started', 'action_required', 'scheduled', 'submitted', 'awaiting_result',
  'completed', 'skipped', 'cancelled',
])
const STEP_RESULTS = new Set<StepResult>(['none', 'passed', 'failed', 'accepted', 'withdrawn'])

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function writeJson<T>(file: string, value: T) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

function assertTextLength(value: string, max: number, label: string) {
  if (value.length > max) throw new Error(`${label} is too long`)
}

function assertOneOf<T extends string>(value: string, allowed: Set<T>, label: string): asserts value is T {
  if (!allowed.has(value as T)) throw new Error(`Invalid ${label}`)
}

function assertEventDates(start: string, end: string) {
  const startTime = Date.parse(start)
  const endTime = Date.parse(end || start)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    throw new Error('Invalid event dates')
  }
}

function normalizeHttpUrl(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`)
  }
  return trimmed
}

function revalidateAll() {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/companies')
  revalidatePath('/companies/[id]', 'page')
  revalidatePath('/settings')
}

function validateProcessLink(
  companyId: string,
  processId?: string,
  stepId?: string
) {
  if (!processId && !stepId) return
  if (!processId) throw new Error('A step requires a process')
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === processId && item.companyId === companyId)
  if (!process) throw new Error('Process not found for company')
  if (stepId && !process.steps.some(step => step.id === stepId)) {
    throw new Error('Step not found for process')
  }
}

export async function updateCompanyNotes(id: string, notes: string) {
  assertTextLength(notes, 2_000_000, 'Notes')
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === id)
  if (company?.readmePath) {
    fs.writeFileSync(resolveExistingRecruitPath(company.readmePath), notes)
  } else {
    const index = companies.findIndex(item => item.id === id)
    if (index !== -1) {
      companies[index].notes = notes
      writeJson(companiesPath, companies)
    }
  }
  revalidateAll()
}

export async function updateEventState(id: string, state: CalendarItemState) {
  assertOneOf(state, EVENT_STATES, 'calendar state')
  const events = readJson<InternEvent[]>(eventsPath, [])
  const event = events.find(item => item.id === id)
  if (event) {
    event.state = state
    writeJson(eventsPath, events)
  }
  revalidateAll()
}

export async function addEvent(event: Omit<InternEvent, 'id'>) {
  assertOneOf(event.type, EVENT_TYPES, 'event type')
  assertOneOf(event.state, EVENT_STATES, 'calendar state')
  assertEventDates(event.start, event.end)
  assertTextLength(event.title, 300, 'Event title')
  assertTextLength(event.note, 10_000, 'Event note')
  const companies = readJson<Company[]>(companiesPath, [])
  if (!companies.some(company => company.id === event.companyId)) throw new Error('Company not found')
  validateProcessLink(event.companyId, event.processId, event.stepId)
  const events = readJson<InternEvent[]>(eventsPath, [])
  events.push({ ...event, id: `evt-${Date.now()}` })
  writeJson(eventsPath, events)
  revalidateAll()
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<InternEvent, 'id' | 'companyId'>>
) {
  if (data.type) assertOneOf(data.type, EVENT_TYPES, 'event type')
  if (data.state) assertOneOf(data.state, EVENT_STATES, 'calendar state')
  if (data.title !== undefined) assertTextLength(data.title, 300, 'Event title')
  if (data.note !== undefined) assertTextLength(data.note, 10_000, 'Event note')
  const events = readJson<InternEvent[]>(eventsPath, [])
  const index = events.findIndex(event => event.id === id)
  if (index !== -1) {
    const next = { ...events[index], ...data }
    assertEventDates(next.start, next.end)
    validateProcessLink(next.companyId, next.processId, next.stepId)
    events[index] = next
    writeJson(eventsPath, events)
  }
  revalidateAll()
}

export async function deleteEvent(id: string) {
  const events = readJson<InternEvent[]>(eventsPath, [])
  writeJson(eventsPath, events.filter(event => event.id !== id))
  revalidateAll()
}

export async function addCompany(data: {
  id: string
  name: string
  category: string
  color: string
  url: string
  mypageUrl: string
  loginId: string
  webTestType?: string
  password?: string
}) {
  assertSafeStorageId(data.id, 'Company ID')
  assertSafeStorageId(data.category, 'Category ID')
  assertTextLength(data.name, 200, 'Company name')
  const companies = readJson<Company[]>(companiesPath, [])
  if (companies.some(company => company.id === data.id)) throw new Error('ID already exists')
  const categories = readJson<CategoryDef[]>(path.join(dataDir, 'categories.json'), [])
  if (!categories.some(category => category.id === data.category)) throw new Error('Category not found')

  const readmePath = `${data.category}/${data.id}/README.md`
  const categoryDir = resolveExistingRecruitPath(data.category)
  const readmeAbsPath = path.join(categoryDir, data.id, 'README.md')
  fs.mkdirSync(path.dirname(readmeAbsPath), { recursive: true })
  if (!fs.existsSync(readmeAbsPath)) fs.writeFileSync(readmeAbsPath, '')

  companies.push({
    ...data,
    url: normalizeHttpUrl(data.url, 'Official URL'),
    mypageUrl: normalizeHttpUrl(data.mypageUrl, 'Mypage URL'),
    readmePath,
    notes: '',
    category: data.category,
    password: data.password ? encryptPassword(data.password) : '',
    trackingState: 'active',
  })
  writeJson(companiesPath, companies)
  revalidateAll()
}

export async function updateCompanyTrackingState(id: string, state: TrackingState) {
  assertOneOf(state, TRACKING_STATES, 'tracking state')
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === id)
  if (company) {
    company.trackingState = state
    delete company.suspended
    writeJson(companiesPath, companies)
  }
  revalidateAll()
}

export async function toggleCompanySuspended(id: string, suspended: boolean) {
  await updateCompanyTrackingState(id, suspended ? 'hold' : 'active')
}

export async function updateCompanyAccount(
  id: string,
  mypageUrl: string,
  loginId: string,
  url: string,
  webTestType?: string,
  password?: string
) {
  assertTextLength(loginId, 500, 'Login ID')
  assertTextLength(webTestType ?? '', 200, 'Web test type')
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === id)
  if (company) {
    company.mypageUrl = normalizeHttpUrl(mypageUrl, 'Mypage URL')
    company.loginId = loginId
    company.url = normalizeHttpUrl(url, 'Official URL')
    company.webTestType = webTestType ?? ''
    company.password = password ? encryptPassword(password) : ''
    writeJson(companiesPath, companies)
  }
  revalidateAll()
}

export async function addCategory(data: CategoryDef) {
  assertSafeStorageId(data.id, 'Category ID')
  assertTextLength(data.label, 100, 'Category label')
  if (!/^#[0-9a-f]{6}$/i.test(data.color)) throw new Error('Invalid category color')
  const categoriesPath = path.join(dataDir, 'categories.json')
  const categories = readJson<CategoryDef[]>(categoriesPath, [])
  if (categories.some(category => category.id === data.id)) throw new Error('ID already exists')
  const folderAbs = resolveRecruitPath(data.id)
  if (fs.existsSync(folderAbs) && fs.lstatSync(folderAbs).isSymbolicLink()) {
    throw new Error('Category folder cannot be a symbolic link')
  }
  fs.mkdirSync(folderAbs, { recursive: true })
  resolveExistingRecruitPath(data.id)
  categories.push(data)
  writeJson(categoriesPath, categories)
  revalidateAll()
}

export async function deleteCompany(id: string) {
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === id)
  if (!company) throw new Error('Company not found')

  const folderRelative = company.readmePath
    ? path.dirname(company.readmePath)
    : path.join(company.category, company.id)
  const folderCandidate = resolveRecruitPath(folderRelative)
  if (fs.existsSync(folderCandidate)) {
    if (fs.lstatSync(folderCandidate).isSymbolicLink()) {
      throw new Error('Company folder cannot be a symbolic link')
    }
    fs.rmSync(resolveExistingRecruitPath(folderRelative), { recursive: true, force: true })
  }

  writeJson(companiesPath, companies.filter(item => item.id !== id))
  const events = readJson<InternEvent[]>(eventsPath, [])
  writeJson(eventsPath, events.filter(event => event.companyId !== id))
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  writeJson(processesPath, processes.filter(process => process.companyId !== id))
  revalidateAll()
}

export async function deleteCategory(id: string) {
  assertSafeStorageId(id, 'Category ID')
  const companies = readJson<Company[]>(companiesPath, [])
  if (companies.some(company => company.category === id)) throw new Error('Category has companies')

  const categoriesPath = path.join(dataDir, 'categories.json')
  const categories = readJson<CategoryDef[]>(categoriesPath, [])
  writeJson(categoriesPath, categories.filter(category => category.id !== id))

  const folderCandidate = resolveRecruitPath(id)
  if (fs.existsSync(folderCandidate)) {
    if (fs.lstatSync(folderCandidate).isSymbolicLink()) {
      throw new Error('Category folder cannot be a symbolic link')
    }
    const folderAbs = resolveExistingRecruitPath(id)
    if (fs.readdirSync(folderAbs).length === 0) fs.rmdirSync(folderAbs)
  }
  revalidateAll()
}

export async function updateSpiCredentials(
  spiMypageUrl: string,
  spiTestCenterId: string,
  spiPassword: string
) {
  assertTextLength(spiTestCenterId, 500, 'SPI test center ID')
  const settingsPath = path.join(dataDir, 'settings.json')
  const current = readJson<Settings>(settingsPath, {})
  writeJson(settingsPath, {
    ...current,
    spiMypageUrl: normalizeHttpUrl(spiMypageUrl, 'SPI mypage URL'),
    spiTestCenterId,
    spiPassword: spiPassword ? encryptPassword(spiPassword) : '',
  })
  revalidateAll()
}

export async function addSelectionProcess(
  companyId: string,
  data: { name: string; kind: ProcessKind; status?: ProcessStatus; result?: ProcessResult }
) {
  assertTextLength(data.name, 200, 'Process name')
  assertOneOf(data.kind, PROCESS_KINDS, 'process kind')
  const status = data.status ?? 'considering'
  const result = data.result ?? 'none'
  assertOneOf(status, PROCESS_STATUSES, 'process status')
  assertOneOf(result, PROCESS_RESULTS, 'process result')
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === companyId)
  if (!company) throw new Error('Company not found')

  const now = new Date().toISOString()
  const process: SelectionProcess = {
    id: `proc-${Date.now()}`,
    companyId,
    name: data.name.trim(),
    kind: data.kind,
    status,
    result,
    steps: [],
    createdAt: now,
    updatedAt: now,
  }
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  processes.push(process)
  writeJson(processesPath, processes)
  if (!company.primaryProcessId) {
    company.primaryProcessId = process.id
    writeJson(companiesPath, companies)
  }
  revalidateAll()
  return process.id
}

export async function updateSelectionProcess(
  id: string,
  data: Partial<Pick<SelectionProcess, 'name' | 'kind' | 'status' | 'result' | 'currentStepId'>>
) {
  if (data.name !== undefined) assertTextLength(data.name, 200, 'Process name')
  if (data.kind) assertOneOf(data.kind, PROCESS_KINDS, 'process kind')
  if (data.status) assertOneOf(data.status, PROCESS_STATUSES, 'process status')
  if (data.result) assertOneOf(data.result, PROCESS_RESULTS, 'process result')
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === id)
  if (!process) throw new Error('Process not found')
  if (data.currentStepId && !process.steps.some(step => step.id === data.currentStepId)) {
    throw new Error('Current step not found')
  }
  Object.assign(process, data, { updatedAt: new Date().toISOString() })
  writeJson(processesPath, processes)
  revalidateAll()
}

export async function deleteSelectionProcess(id: string) {
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === id)
  if (!process) return
  writeJson(processesPath, processes.filter(item => item.id !== id))

  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === process.companyId)
  if (company?.primaryProcessId === id) {
    company.primaryProcessId = processes.find(
      item => item.companyId === process.companyId && item.id !== id
    )?.id
    writeJson(companiesPath, companies)
  }

  const events = readJson<InternEvent[]>(eventsPath, [])
  for (const event of events) {
    if (event.processId === id) {
      delete event.processId
      delete event.stepId
    }
  }
  writeJson(eventsPath, events)
  revalidateAll()
}

export async function setPrimaryProcess(companyId: string, processId: string) {
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  if (!processes.some(process => process.id === processId && process.companyId === companyId)) {
    throw new Error('Process not found for company')
  }
  const companies = readJson<Company[]>(companiesPath, [])
  const company = companies.find(item => item.id === companyId)
  if (!company) throw new Error('Company not found')
  company.primaryProcessId = processId
  writeJson(companiesPath, companies)
  revalidateAll()
}

export async function addSelectionStep(
  processId: string,
  data: { label: string; kind: StepKind; state?: StepState; result?: StepResult }
) {
  assertTextLength(data.label, 200, 'Step label')
  assertOneOf(data.kind, STEP_KINDS, 'step kind')
  const state = data.state ?? 'not_started'
  const result = data.result ?? 'none'
  assertOneOf(state, STEP_STATES, 'step state')
  assertOneOf(result, STEP_RESULTS, 'step result')

  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === processId)
  if (!process) throw new Error('Process not found')
  const step = {
    id: `step-${Date.now()}`,
    label: data.label.trim(),
    kind: data.kind,
    state,
    result,
    order: process.steps.length,
  }
  process.steps.push(step)
  process.currentStepId ??= step.id
  process.updatedAt = new Date().toISOString()
  writeJson(processesPath, processes)
  revalidateAll()
  return step.id
}

export async function updateSelectionStep(
  processId: string,
  stepId: string,
  data: Partial<Pick<SelectionProcess['steps'][number], 'label' | 'kind' | 'state' | 'result'>>
) {
  if (data.label !== undefined) assertTextLength(data.label, 200, 'Step label')
  if (data.kind) assertOneOf(data.kind, STEP_KINDS, 'step kind')
  if (data.state) assertOneOf(data.state, STEP_STATES, 'step state')
  if (data.result) assertOneOf(data.result, STEP_RESULTS, 'step result')
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === processId)
  const step = process?.steps.find(item => item.id === stepId)
  if (!process || !step) throw new Error('Step not found')
  Object.assign(step, data)
  process.updatedAt = new Date().toISOString()
  writeJson(processesPath, processes)
  revalidateAll()
}

export async function setCurrentStep(processId: string, stepId: string) {
  await updateSelectionProcess(processId, { currentStepId: stepId, status: 'active' })
}

export async function reorderSelectionStep(
  processId: string,
  stepId: string,
  direction: 'up' | 'down'
) {
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === processId)
  if (!process) throw new Error('Process not found')
  const steps = [...process.steps].sort((a, b) => a.order - b.order)
  const index = steps.findIndex(step => step.id === stepId)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= steps.length) return
  ;[steps[index], steps[target]] = [steps[target], steps[index]]
  process.steps = steps.map((step, order) => ({ ...step, order }))
  process.updatedAt = new Date().toISOString()
  writeJson(processesPath, processes)
  revalidateAll()
}

export async function deleteSelectionStep(processId: string, stepId: string) {
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const process = processes.find(item => item.id === processId)
  if (!process) throw new Error('Process not found')
  process.steps = process.steps
    .filter(step => step.id !== stepId)
    .map((step, order) => ({ ...step, order }))
  if (process.currentStepId === stepId) process.currentStepId = process.steps[0]?.id
  process.updatedAt = new Date().toISOString()
  writeJson(processesPath, processes)

  const events = readJson<InternEvent[]>(eventsPath, [])
  for (const event of events) {
    if (event.stepId === stepId) delete event.stepId
  }
  writeJson(eventsPath, events)
  revalidateAll()
}

export async function moveSelectionStep(
  companyId: string,
  fromProcessId: string,
  stepId: string,
  toProcessId: string
) {
  if (fromProcessId === toProcessId) return
  const processes = readJson<SelectionProcess[]>(processesPath, [])
  const from = processes.find(item => item.id === fromProcessId && item.companyId === companyId)
  const to = processes.find(item => item.id === toProcessId && item.companyId === companyId)
  const step = from?.steps.find(item => item.id === stepId)
  if (!from || !to || !step) throw new Error('Process or step not found')
  from.steps = from.steps.filter(item => item.id !== stepId).map((item, order) => ({ ...item, order }))
  to.steps.push({ ...step, order: to.steps.length })
  if (from.currentStepId === stepId) from.currentStepId = from.steps[0]?.id
  to.currentStepId ??= step.id
  const now = new Date().toISOString()
  from.updatedAt = now
  to.updatedAt = now
  writeJson(processesPath, processes)

  const events = readJson<InternEvent[]>(eventsPath, [])
  for (const event of events) {
    if (event.stepId === stepId) event.processId = toProcessId
  }
  writeJson(eventsPath, events)
  revalidateAll()
}
