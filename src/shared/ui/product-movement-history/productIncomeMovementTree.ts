export type ProductIncomeMovementTreeSource = {
  Currency?: string
  ImportedForAmg?: boolean | null
  IncomeQty?: number
  IncomeToStorageDate?: Date | string
  IncomeToStorageNumber?: string | number
  IsHide?: boolean
  NetPrice?: number
  OrganizationName?: string
  RemainingQty?: number
  SourceDocumentId?: string | null
  SourceDocumentType?: number | null
  StorageName?: string
  SupplierName?: string
}

const productIncomeDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  year: 'numeric',
})

const naiveIsoDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/

export type ProductIncomeMovementTreeRow<T extends ProductIncomeMovementTreeSource> = T & {
  Branches: T[]
  TreeKey: string
}

export function buildProductIncomeMovementTree<T extends ProductIncomeMovementTreeSource>(
  rows: readonly T[],
): ProductIncomeMovementTreeRow<T>[] {
  const groups = new Map<string, Array<{ index: number; row: T }>>()

  rows.forEach((row, index) => {
    const treeKey = getIncomeTreeGroupKey(row, index)
    const group = groups.get(treeKey)

    if (group) {
      group.push({ index, row })
    } else {
      groups.set(treeKey, [{ index, row }])
    }
  })

  return Array.from(groups).flatMap(([treeKey, entries]) =>
    partitionSourceDocuments(entries).map((sourceEntries, sourceIndex) => {
      const primary = sourceEntries.reduce((current, candidate) =>
        compareIncomeMovementPriority(candidate, current) > 0 ? candidate : current,
      )

      return {
        ...primary.row,
        Branches: sourceEntries.map((entry) => entry.row),
        TreeKey: `${treeKey}|source:${sourceIndex}`,
      }
    }),
  )
}

export function hasCrossSourceStockCollision<T extends ProductIncomeMovementTreeSource>(
  rows: readonly T[],
): boolean {
  const groups = new Map<string, T[]>()

  rows.forEach((row, index) => {
    const key = getIncomeTreeGroupKey(row, index)
    const group = groups.get(key)

    if (group) {
      group.push(row)
    } else {
      groups.set(key, [row])
    }
  })

  return Array.from(groups.values()).some((group) => group.some((left, leftIndex) =>
    left.IsHide === true
    && Boolean(getSourceDocumentIdentity(left))
    && group.some((right, rightIndex) => rightIndex !== leftIndex
      && right.IsHide === true
      && typeof left.ImportedForAmg === 'boolean'
      && typeof right.ImportedForAmg === 'boolean'
      && left.ImportedForAmg !== right.ImportedForAmg
      && Boolean(getSourceDocumentIdentity(right))
      && hasMatchingDocumentValues(left, right)),
  ))
}

export function formatProductIncomeMovementDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  if (typeof value === 'string') {
    const literalWallClock = formatNaiveIsoWallClock(value)

    if (literalWallClock) {
      return literalWallClock
    }
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? String(value)
    : productIncomeDateTimeFormatter.format(date)
}

function formatNaiveIsoWallClock(value: string): string | null {
  const match = naiveIsoDateTimePattern.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match
  const validationDate = new Date(0)
  validationDate.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  validationDate.setUTCHours(Number(hour), Number(minute), Number(second), 0)

  if (validationDate.getUTCFullYear() !== Number(year)
    || validationDate.getUTCMonth() !== Number(month) - 1
    || validationDate.getUTCDate() !== Number(day)
    || validationDate.getUTCHours() !== Number(hour)
    || validationDate.getUTCMinutes() !== Number(minute)
    || validationDate.getUTCSeconds() !== Number(second)) {
    return null
  }

  return `${day}.${month}.${year}, ${hour}:${minute}:${second}`
}

function compareIncomeMovementPriority<T extends ProductIncomeMovementTreeSource>(
  left: { index: number; row: T },
  right: { index: number; row: T },
): number {
  const leftHasStock = Math.abs(left.row.RemainingQty ?? 0) > 0.000001 ? 1 : 0
  const rightHasStock = Math.abs(right.row.RemainingQty ?? 0) > 0.000001 ? 1 : 0

  if (leftHasStock !== rightHasStock) {
    return leftHasStock - rightHasStock
  }

  const dateDifference = toTimestamp(left.row.IncomeToStorageDate) - toTimestamp(right.row.IncomeToStorageDate)

  return dateDifference || right.index - left.index
}

function partitionSourceDocuments<T extends ProductIncomeMovementTreeSource>(
  entries: Array<{ index: number; row: T }>,
): Array<Array<{ index: number; row: T }>> {
  if (entries.length === 2) {
    const left = entries[0]!
    const right = entries[1]!
    const hasSourceIdentities = Boolean(
      getSourceDocumentIdentity(left.row)
      && getSourceDocumentIdentity(right.row),
    )
    const isComplementarySourcePair = typeof left.row.ImportedForAmg === 'boolean'
      && typeof right.row.ImportedForAmg === 'boolean'
      && left.row.ImportedForAmg !== right.row.ImportedForAmg
    const isHistoricalAndOperationalPair = typeof left.row.IsHide === 'boolean'
      && typeof right.row.IsHide === 'boolean'
      && left.row.IsHide !== right.row.IsHide

    if (hasSourceIdentities
      && isComplementarySourcePair
      && isHistoricalAndOperationalPair
      && hasMatchingDocumentValues(left.row, right.row)) {
      return [entries]
    }
  }

  return entries.map((entry) => [entry])
}

function hasMatchingDocumentValues(
  left: ProductIncomeMovementTreeSource,
  right: ProductIncomeMovementTreeSource,
): boolean {
  const leftCurrency = normalizeTreePart(left.Currency)
  const rightCurrency = normalizeTreePart(right.Currency)

  return typeof left.SourceDocumentType === 'number'
    && typeof right.SourceDocumentType === 'number'
    && left.SourceDocumentType === right.SourceDocumentType
    && typeof left.IncomeQty === 'number'
    && typeof right.IncomeQty === 'number'
    && typeof left.NetPrice === 'number'
    && typeof right.NetPrice === 'number'
    && Boolean(leftCurrency)
    && left.IncomeQty === right.IncomeQty
    && left.NetPrice === right.NetPrice
    && leftCurrency === rightCurrency
}

function getSourceDocumentIdentity(row: ProductIncomeMovementTreeSource): string | null {
  const sourceDocumentId = row.SourceDocumentId?.trim()

  if (!sourceDocumentId || typeof row.ImportedForAmg !== 'boolean') {
    return null
  }

  return [
    row.ImportedForAmg ? 'amg' : 'fenix',
    row.SourceDocumentType ?? 'unknown',
    sourceDocumentId,
  ].join('|')
}

function getIncomeTreeGroupKey(
  row: ProductIncomeMovementTreeSource,
  index: number,
): string {
  const documentNumber = normalizeTreePart(row.IncomeToStorageNumber)

  return documentNumber
    ? [
        normalizeTreePart(row.OrganizationName),
        normalizeTreePart(row.StorageName),
        normalizeTreePart(row.SupplierName),
        documentNumber,
      ].join('|')
    : `unlinked:${index}`
}

function normalizeTreePart(value?: string | number): string {
  return String(value ?? '').trim().toLocaleUpperCase('uk-UA')
}

function toTimestamp(value?: Date | string): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}
