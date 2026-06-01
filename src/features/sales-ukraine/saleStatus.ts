export function getStatusTypeKey(value: number | string | null | undefined): string {
  return value === null || typeof value === 'undefined' ? '' : String(value)
}

export function isStatusType(value: number | string | null | undefined, expected: number): boolean {
  return getStatusTypeKey(value) === String(expected)
}
