import { formatKyivBusinessDate } from '../../shared/date/dateTime'

export const ONE_C_EXPORT_PRESETS = ['today', 'yesterday', 'currentMonth', 'previousMonth', 'untilToday', 'custom'] as const
export type OneCExportPreset = (typeof ONE_C_EXPORT_PRESETS)[number]

export const ONE_C_EXPORT_PRESET_LABELS: Record<OneCExportPreset, string> = {
  today: 'Сьогодні',
  yesterday: 'Вчора',
  currentMonth: 'Поточний місяць',
  previousMonth: 'Попередній місяць',
  untilToday: 'Від дати по сьогодні',
  custom: 'Довільний період',
}

export type OneCExportPeriod = { from: string; to: string | null }

function shift(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function resolveOneCExportPeriod(
  preset: OneCExportPreset,
  custom: { from: string; to: string },
  now: Date = new Date(),
): OneCExportPeriod {
  const today = formatKyivBusinessDate(now)
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yesterday = shift(today, -1)
      return { from: yesterday, to: yesterday }
    }
    case 'currentMonth':
      return { from: monthStart(today), to: today }
    case 'previousMonth': {
      const lastDay = shift(monthStart(today), -1)
      return { from: monthStart(lastDay), to: lastDay }
    }
    case 'untilToday':
      return { from: custom.from || today, to: null }
    case 'custom':
      return { from: custom.from || today, to: custom.to || today }
  }
}

export function validateOneCExportPeriod(period: OneCExportPeriod, now: Date = new Date()): string | null {
  const today = formatKyivBusinessDate(now)
  const pattern = /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(period.from) || (period.to !== null && !pattern.test(period.to))) {
    return 'Вкажіть коректні дати періоду'
  }
  const to = period.to ?? today
  if (period.from > to) return 'Дата початку має бути не пізніше дати завершення'
  return null
}
