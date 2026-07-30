import fs from 'fs'
import path from 'path'

export const recruitRoot = process.env.RECRUIT_ROOT
  ? path.resolve(process.env.RECRUIT_ROOT)
  : path.resolve(process.cwd(), '..')

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

/**
 * RECRUIT_ROOT 配下のパスだけを返す。
 * 存在しない新規ファイル・ディレクトリの作成前検証にも使用する。
 */
export function resolveRecruitPath(relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error('Invalid recruit path')
  }

  const candidate = path.resolve(recruitRoot, relativePath)
  if (!isInside(recruitRoot, candidate)) {
    throw new Error('Path escapes RECRUIT_ROOT')
  }
  return candidate
}

/**
 * シンボリックリンク解決後も RECRUIT_ROOT 配下であることを検証する。
 */
export function resolveExistingRecruitPath(relativePath: string) {
  const candidate = resolveRecruitPath(relativePath)
  const realRoot = fs.realpathSync(recruitRoot)
  const realCandidate = fs.realpathSync(candidate)
  if (!isInside(realRoot, realCandidate)) {
    throw new Error('Resolved path escapes RECRUIT_ROOT')
  }
  return realCandidate
}

/**
 * フォルダ名に利用するIDを限定し、区切り文字や ".." を拒否する。
 */
export function assertSafeStorageId(value: string, label: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) {
    throw new Error(`${label} must use only letters, numbers, "_" or "-"`)
  }
}
