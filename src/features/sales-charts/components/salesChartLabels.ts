/** Products without a Top category come back under the empty key. */
export function productTopColumnLabel(key: string, emptyLabel: string): string {
  return key.trim() ? key : emptyLabel
}
