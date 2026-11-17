/** Both values are ISO dates (yyyy-mm-dd), so string order is date order. */
export function isReportDateRangeReversed(from: string | null | undefined, to: string | null | undefined): boolean {
  return Boolean(from && to && from > to)
}
