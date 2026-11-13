export const QUANTITY_BREAKDOWN_PROVENANCE = 'quantityBreakdown'
export const QUANTITY_BREAKDOWN_SEPARATOR = ' · '

export function quantityBreakdownText(value: string): string {
  return value.split(QUANTITY_BREAKDOWN_SEPARATOR).map(part => part.trim().replace(/ /g, ' ')).join(QUANTITY_BREAKDOWN_SEPARATOR)
}
