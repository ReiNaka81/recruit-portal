import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'src/data')
const apply = process.argv.includes('--apply')
const today = new Date()
today.setHours(0, 0, 0, 0)

const readJson = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
const companies = readJson('companies.json')
const legacyEvents = readJson('events.json')

if (legacyEvents.every(event => event.state && !Object.hasOwn(event, 'status'))) {
  console.log('Status model is already migrated. No changes were made.')
  process.exit(0)
}

const stepKind = event => {
  const title = event.title.toLowerCase()
  if (/内定|オファー/.test(title)) return 'offer'
  if (/インターン|ワークショップ/.test(title) || event.type === 'internship') return 'internship'
  if (/面接|面談/.test(title)) return 'interview'
  if (/gd|グループディスカッション/.test(title)) return 'group_discussion'
  if (/spi|web.?テスト|テストセンター|適性/.test(title)) return 'aptitude_test'
  if (/es|書類/.test(title)) return 'document'
  if (/エントリー|応募/.test(title) || event.type === 'deadline') return 'entry'
  return 'other'
}

const stepStateAndResult = event => {
  switch (event.status) {
    case 'pending':
      return {
        state: event.type === 'deadline' ? 'action_required' : 'scheduled',
        result: 'none',
      }
    case 'applied':
      return { state: 'submitted', result: 'none' }
    case 'in_progress':
      return { state: 'awaiting_result', result: 'none' }
    case 'passed':
      return { state: 'completed', result: 'passed' }
    case 'rejected':
      return { state: 'completed', result: 'failed' }
    case 'done':
      return { state: 'completed', result: 'none' }
    case 'confirmed':
      return {
        state: new Date(event.end || event.start) >= today ? 'scheduled' : 'completed',
        result: 'accepted',
      }
    default:
      return { state: 'action_required', result: 'none' }
  }
}

const calendarState = event => {
  if (event.status === 'pending' && event.type === 'deadline') return 'todo'
  if (['passed', 'rejected', 'done'].includes(event.status)) return 'done'
  if (event.status === 'confirmed') {
    return new Date(event.end || event.start) >= today ? 'scheduled' : 'done'
  }
  if (event.type !== 'deadline' && new Date(event.end || event.start) >= today) return 'scheduled'
  return event.status === 'pending' ? 'todo' : 'done'
}

const processes = []
const eventLinks = new Map()

for (const company of companies) {
  const processEvents = legacyEvents
    .filter(event => event.companyId === company.id && event.type !== 'event')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  if (processEvents.length === 0) continue

  const processId = `proc-${company.id}-legacy`
  const steps = processEvents.map((event, order) => {
    const mapped = stepStateAndResult(event)
    const step = {
      id: `step-${event.id}`,
      label: event.title,
      kind: stepKind(event),
      state: mapped.state,
      result: mapped.result,
      order,
    }
    eventLinks.set(event.id, { processId, stepId: step.id })
    return step
  })
  const current = steps.find(step =>
    ['action_required', 'scheduled', 'submitted', 'awaiting_result'].includes(step.state)
  )
  const hasAccepted = steps.some(step => step.result === 'accepted')
  const hasFailed = steps.some(step => step.result === 'failed')
  const hasPassed = steps.some(step => step.result === 'passed')
  const hasActive = !!current
  const result = hasAccepted
    ? 'accepted'
    : hasFailed && !hasPassed && !hasActive
      ? 'rejected'
      : 'none'
  const status = hasActive
    ? 'active'
    : result === 'rejected'
      ? 'closed'
      : 'completed'
  const now = new Date().toISOString()

  processes.push({
    id: processId,
    companyId: company.id,
    name: '既存選考（要確認）',
    kind: processEvents.some(event => event.type === 'internship') ? 'internship' : 'other',
    status,
    result,
    ...(current ? { currentStepId: current.id } : {}),
    steps,
    createdAt: now,
    updatedAt: now,
  })
}

const nextCompanies = companies.map(company => {
  const process = processes.find(item => item.companyId === company.id)
  const { suspended, ...rest } = company
  return {
    ...rest,
    trackingState: suspended ? 'hold' : (company.trackingState ?? 'active'),
    ...(process ? { primaryProcessId: process.id } : {}),
  }
})

const nextEvents = legacyEvents.map(event => {
  const link = eventLinks.get(event.id)
  const { status, ...rest } = event
  return {
    ...rest,
    state: calendarState(event),
    ...(link ?? {}),
    legacyStatus: status,
  }
})

const summary = {
  companies: nextCompanies.length,
  processes: processes.length,
  steps: processes.reduce((sum, process) => sum + process.steps.length, 0),
  events: nextEvents.length,
  reviewRequired: processes.filter(process => process.name.includes('要確認')).length,
}

if (!apply) {
  console.log(JSON.stringify(summary, null, 2))
  console.log('Dry run only. Re-run with --apply to create a backup and migrate data.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(dataDir, 'backups', `status-v1-${stamp}`)
fs.mkdirSync(backupDir, { recursive: true })
for (const name of ['companies.json', 'events.json', 'processes.json']) {
  const source = path.join(dataDir, name)
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backupDir, name))
}

fs.writeFileSync(path.join(dataDir, 'companies.json'), JSON.stringify(nextCompanies, null, 2))
fs.writeFileSync(path.join(dataDir, 'events.json'), JSON.stringify(nextEvents, null, 2))
fs.writeFileSync(path.join(dataDir, 'processes.json'), JSON.stringify(processes, null, 2))

console.log(JSON.stringify({ ...summary, backupDir }, null, 2))
