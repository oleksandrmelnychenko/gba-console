export type AiHistoryLineage = {
  source_history_start: string
  effective_start: string
  history_complete: boolean
  requested_start?: string
  effective_history_days?: number
  history_not_applicable?: string[]
}

type ContractErrorFactory = (path: string, reason: string) => Error

type NormalizeAiHistoryLineageOptions = {
  asOf: unknown
  expectedAsOf?: string
  requireRequestedStart?: boolean
  requireEffectiveHistoryDays?: boolean
  requiredHistoryNotApplicable?: readonly string[]
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_IN_MS = 86_400_000

export function hasAiHistoryLineage(value: Partial<AiHistoryLineage>): value is AiHistoryLineage {
  return (
    typeof value.source_history_start === 'string' &&
    typeof value.effective_start === 'string' &&
    typeof value.history_complete === 'boolean'
  )
}

export function normalizeAiHistoryLineage(
  value: Record<string, unknown>,
  path: string,
  createError: ContractErrorFactory,
  options: NormalizeAiHistoryLineageOptions,
): AiHistoryLineage {
  const asOf = requireAiIsoDate(options.asOf, `${path}.as_of`, createError)
  if (options.expectedAsOf !== undefined && asOf !== options.expectedAsOf) {
    throw createError(`${path}.as_of`, 'does not echo the requested business date')
  }

  const sourceHistoryStart = requireAiIsoDate(
    value.source_history_start,
    `${path}.source_history_start`,
    createError,
  )
  const effectiveStart = requireAiIsoDate(
    value.effective_start,
    `${path}.effective_start`,
    createError,
  )
  const historyComplete = requireBoolean(
    value.history_complete,
    `${path}.history_complete`,
    createError,
  )

  if (sourceHistoryStart > effectiveStart || effectiveStart > asOf) {
    throw createError(path, 'history dates must satisfy source <= effective <= as_of')
  }

  const lineage: AiHistoryLineage = {
    source_history_start: sourceHistoryStart,
    effective_start: effectiveStart,
    history_complete: historyComplete,
  }

  if (options.requireRequestedStart || value.requested_start !== undefined) {
    const requestedStart = requireAiIsoDate(
      value.requested_start,
      `${path}.requested_start`,
      createError,
    )
    const expectedEffectiveStart =
      requestedStart > sourceHistoryStart ? requestedStart : sourceHistoryStart
    const expectedHistoryComplete = requestedStart >= sourceHistoryStart

    if (effectiveStart !== expectedEffectiveStart) {
      throw createError(
        `${path}.effective_start`,
        'must equal the later of requested_start and source_history_start',
      )
    }
    if (historyComplete !== expectedHistoryComplete) {
      throw createError(
        `${path}.history_complete`,
        'does not match requested_start availability',
      )
    }

    lineage.requested_start = requestedStart
  }

  if (options.requireEffectiveHistoryDays || value.effective_history_days !== undefined) {
    const effectiveHistoryDays = requireNonNegativeInteger(
      value.effective_history_days,
      `${path}.effective_history_days`,
      createError,
    )
    if (effectiveHistoryDays !== daysBetween(effectiveStart, asOf)) {
      throw createError(
        `${path}.effective_history_days`,
        'does not match effective_start and as_of',
      )
    }

    lineage.effective_history_days = effectiveHistoryDays
  }

  if (
    options.requiredHistoryNotApplicable !== undefined ||
    value.history_not_applicable !== undefined
  ) {
    const actual = requireUniqueStringArray(
      value.history_not_applicable,
      `${path}.history_not_applicable`,
      createError,
    )
    if (
      options.requiredHistoryNotApplicable !== undefined &&
      !sameStringSet(actual, options.requiredHistoryNotApplicable)
    ) {
      throw createError(
        `${path}.history_not_applicable`,
        `must contain exactly ${options.requiredHistoryNotApplicable.join(', ')}`,
      )
    }

    lineage.history_not_applicable = actual
  }

  return lineage
}

export function requireAiIsoDate(
  value: unknown,
  path: string,
  createError: ContractErrorFactory,
): string {
  if (typeof value !== 'string') {
    throw createError(path, 'must be an ISO date')
  }

  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    throw createError(path, 'must be an ISO date')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw createError(path, 'must be a valid calendar date')
  }

  return value
}

function requireBoolean(
  value: unknown,
  path: string,
  createError: ContractErrorFactory,
): boolean {
  if (typeof value !== 'boolean') {
    throw createError(path, 'must be a boolean')
  }

  return value
}

function requireNonNegativeInteger(
  value: unknown,
  path: string,
  createError: ContractErrorFactory,
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw createError(path, 'must be a non-negative integer')
  }

  return value
}

function requireUniqueStringArray(
  value: unknown,
  path: string,
  createError: ContractErrorFactory,
): string[] {
  if (!Array.isArray(value)) {
    throw createError(path, 'must be an array')
  }

  const result: string[] = []
  const seen = new Set<string>()
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw createError(`${path}[${index}]`, 'must be a non-empty string')
    }
    if (seen.has(item)) {
      throw createError(`${path}[${index}]`, 'must be unique')
    }
    seen.add(item)
    result.push(item)
  })

  return result
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_IN_MS)
}

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((value) => actual.includes(value))
}
