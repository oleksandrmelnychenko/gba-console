export type PhysicalCoverage = {
  PublicationId: string
  StorageId: number
  AvailableFromUtc: string
  AvailableThroughExclusiveUtc: string
  CurrentStateAsOfUtc: string
  CurrentStateReceiptId: string
  RequestedFromUtc: string
  RequestedToExclusiveUtc: string
  NativeObservedAtUtc: string
  ImportedPeriodComplete: boolean
}

export type PhysicalCoverageListener = (coverage: PhysicalCoverage[]) => void

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const instant = (value: unknown): value is string => typeof value === 'string'
  && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value))

export function readPhysicalCoverage(value: unknown): PhysicalCoverage[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 4096) throw new Error('Сервер повернув некоректні межі історії руху.')
  return value.map(item => {
    if (!record(item) || typeof item.PublicationId !== 'string' || typeof item.CurrentStateReceiptId !== 'string'
      || !Number.isSafeInteger(item.StorageId) || Number(item.StorageId) <= 0 || typeof item.ImportedPeriodComplete !== 'boolean'
      || !instant(item.AvailableFromUtc) || !instant(item.AvailableThroughExclusiveUtc)
      || !instant(item.CurrentStateAsOfUtc) || !instant(item.RequestedFromUtc)
      || !instant(item.RequestedToExclusiveUtc) || !instant(item.NativeObservedAtUtc)
      || Date.parse(item.AvailableThroughExclusiveUtc) <= Date.parse(item.AvailableFromUtc)
      || Date.parse(item.RequestedToExclusiveUtc) <= Date.parse(item.RequestedFromUtc)) {
      throw new Error('Сервер повернув некоректні межі історії руху.')
    }
    return item as PhysicalCoverage
  })
}

export function physicalMovementResponse(value: unknown): { body: unknown; coverage: PhysicalCoverage[] } {
  const envelope = record(value) ? value : undefined
  return {
    body: envelope && 'Body' in envelope ? envelope.Body : value,
    coverage: readPhysicalCoverage(envelope?.PhysicalCoverage),
  }
}

const kyivDay = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' })
export function physicalCoverageIntervals(coverage: readonly PhysicalCoverage[]): string[] {
  return [...new Set(coverage.filter(item => !item.ImportedPeriodComplete).map(item =>
    `${kyivDay.format(new Date(item.AvailableFromUtc))} — ${kyivDay.format(new Date(Date.parse(item.AvailableThroughExclusiveUtc) - 1))}`))]
}
