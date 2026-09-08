import type { RegisterPeriodDraft } from './types'

const LOCAL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{7}$/
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Calendar validation only. Source wall-clock values never enter JS Date or a timezone conversion. */
export function isRegisterLocalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = LOCAL_TIMESTAMP.exec(value)
  if (!match) return false
  const [year, month, day, hour, minute, second] = match.slice(1).map(part => Number(part))
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day >= 1 && day <= (month === 2 && leap ? 29 : DAYS[month - 1])
}

export function registerPeriodDraft(value = ''): RegisterPeriodDraft {
  if (!value) return { date: '', time: '', fraction: '' }
  if (!isRegisterLocalTimestamp(value)) throw new Error('Некоректний локальний час джерела.')
  return { date: value.slice(0, 10), time: value.slice(11, 19), fraction: value.slice(20) }
}

export function formatRegisterPeriod(value: RegisterPeriodDraft): string | null {
  if (!value || typeof value.date !== 'string' || typeof value.time !== 'string' || typeof value.fraction !== 'string') return null
  if (Object.keys(value).some(key => !['date', 'time', 'fraction'].includes(key)) || !/^\d{0,7}$/.test(value.fraction)) return null
  const time = /^\d{2}:\d{2}$/.test(value.time) ? `${value.time}:00` : value.time
  const result = `${value.date}T${time}.${value.fraction.padEnd(7, '0')}`
  return isRegisterLocalTimestamp(result) ? result : null
}

export function displayRegisterPeriod(value: string): string {
  if (!isRegisterLocalTimestamp(value)) return 'Некоректний період'
  const fraction = value.slice(20)
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} ${value.slice(11, 19)}${fraction === '0000000' ? '' : `,${fraction}`}`
}
