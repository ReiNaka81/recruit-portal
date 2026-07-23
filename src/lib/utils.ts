import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 企業/業界用のカラーパレット。見分けやすい色相を選定。
 * Tailwind の 500 番台ベース。
 */
export const COLOR_PALETTE: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
]

/**
 * 既に使われている色を避けて、パレットから1色選ぶ。
 * - 未使用の色があればそれを返す
 * - 全て使用済なら、最も使用回数の少ない色を返す
 */
export function pickUnusedColor(usedColors: string[]): string {
  const norm = (c: string) => c.toLowerCase()
  const usedCount = new Map<string, number>()
  for (const c of usedColors) {
    const k = norm(c)
    usedCount.set(k, (usedCount.get(k) ?? 0) + 1)
  }
  let best = COLOR_PALETTE[0]
  let bestCount = Infinity
  for (const c of COLOR_PALETTE) {
    const k = norm(c)
    const count = usedCount.get(k) ?? 0
    if (count < bestCount) {
      bestCount = count
      best = c
      if (count === 0) break
    }
  }
  return best
}
