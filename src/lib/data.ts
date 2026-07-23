import fs from 'fs'
import path from 'path'
import {
  CalendarItemState,
  Company,
  CategoryDef,
  InternEvent,
  LegacyStatus,
  SelectionProcess,
  Settings,
} from '@/types'
import { decryptPassword, isEncrypted } from './crypto'
import {
  resolveExistingRecruitPath,
} from './paths'

const dataDir = path.join(process.cwd(), 'src/data')

export function getCompanies(): Company[] {
  const companies: Company[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'companies.json'), 'utf-8'))
  return companies.map(c => {
    c.trackingState ??= c.suspended ? 'hold' : 'active'
    if (c.readmePath) {
      try {
        c.notes = fs.readFileSync(resolveExistingRecruitPath(c.readmePath), 'utf-8')
      } catch {
        // readmePath が見つからない場合は JSON の notes にフォールバック
      }
    }
    if (c.password && isEncrypted(c.password)) {
      try {
        c.password = decryptPassword(c.password)
      } catch (err) {
        console.error(`[crypto] failed to decrypt password for ${c.id}:`, err)
        c.password = ''
      }
    }
    return c
  })
}

export function getCategories(): CategoryDef[] {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf-8'))
}

export function getEvents(): InternEvent[] {
  const events = JSON.parse(fs.readFileSync(path.join(dataDir, 'events.json'), 'utf-8')) as Array<
    Omit<InternEvent, 'state'> & { state?: CalendarItemState; status?: LegacyStatus }
  >
  return events.map(event => {
    if (event.state) return event as InternEvent
    const legacyStatus = event.status ?? event.legacyStatus ?? 'pending'
    const state: CalendarItemState =
      legacyStatus === 'pending'
        ? event.type === 'deadline' ? 'todo' : 'scheduled'
        : ['passed', 'rejected', 'done'].includes(legacyStatus)
          ? 'done'
          : 'scheduled'
    const { status: _status, ...rest } = event
    void _status
    return { ...rest, state, legacyStatus }
  })
}

export function getProcesses(): SelectionProcess[] {
  const processesPath = path.join(dataDir, 'processes.json')
  if (!fs.existsSync(processesPath)) return []
  const processes: SelectionProcess[] = JSON.parse(fs.readFileSync(processesPath, 'utf-8'))
  return processes.map(process => ({
    ...process,
    steps: [...process.steps].sort((a, b) => a.order - b.order),
  }))
}

export function getSettings(): Settings {
  const settingsPath = path.join(dataDir, 'settings.json')
  if (!fs.existsSync(settingsPath)) return {}
  const settings: Settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  if (settings.spiPassword && isEncrypted(settings.spiPassword)) {
    try {
      settings.spiPassword = decryptPassword(settings.spiPassword)
    } catch (err) {
      console.error('[crypto] failed to decrypt spiPassword:', err)
      settings.spiPassword = ''
    }
  }
  return settings
}

export interface CompanyFile {
  name: string
  relativePath: string
  ext: string
}

export function getCompanyFiles(company: Company): CompanyFile[] {
  if (!company.readmePath) return []
  const folderRelative = path.dirname(company.readmePath)
  try {
    const folder = resolveExistingRecruitPath(folderRelative)
    return fs.readdirSync(folder, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.') && entry.isFile())
      .map(entry => {
        const relativePath = path.join(folderRelative, entry.name)
        // ファイル自体がシンボリックリンク等でルート外を指していないことも確認する。
        resolveExistingRecruitPath(relativePath)
        return {
          name: entry.name,
          relativePath,
          ext: path.extname(entry.name).toLowerCase().slice(1),
        }
      })
  } catch {
    return []
  }
}

/**
 * APIから開けるのは、登録済み企業の直下に実在する通常ファイルだけ。
 */
export function resolveRegisteredCompanyFile(relativePath: string): string | null {
  if (!relativePath || path.isAbsolute(relativePath)) return null
  const normalized = path.normalize(relativePath)
  if (normalized.startsWith(`..${path.sep}`) || normalized === '..') return null

  const companies: Company[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'companies.json'), 'utf-8')
  )
  for (const company of companies) {
    const match = getCompanyFiles(company)
      .find(file => path.normalize(file.relativePath) === normalized)
    if (match) {
      try {
        return resolveExistingRecruitPath(match.relativePath)
      } catch {
        return null
      }
    }
  }
  return null
}
