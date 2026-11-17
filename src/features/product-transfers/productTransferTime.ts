type TransferDates = {
  Created?: Date | string
  FromDate?: Date | string
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function isMidnight(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

/**
 * Moment whose time is shown under a transfer date. An import stores only the
 * date, so its FromDate is midnight; then the creation time of that same day
 * is used, and nothing (never a misleading «00:00») when there is none.
 */
export function getTransferTimeSource(transfer: TransferDates): Date | null {
  const fromDate = toDate(transfer.FromDate)

  if (!fromDate) {
    return null
  }

  if (!isMidnight(fromDate)) {
    return fromDate
  }

  const created = toDate(transfer.Created)

  return created && isSameDay(created, fromDate) && !isMidnight(created) ? created : null
}
