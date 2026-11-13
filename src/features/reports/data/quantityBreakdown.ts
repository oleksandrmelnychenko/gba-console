export const QUANTITY_BREAKDOWN_PROVENANCE = 'quantityBreakdown'
const QUANTITY_BREAKDOWN_SEPARATOR = ' · '

export function quantityBreakdownText(value: string): string {
  return value.split(QUANTITY_BREAKDOWN_SEPARATOR).map(part => part.trim().replace(/ /g, ' ')).join(QUANTITY_BREAKDOWN_SEPARATOR)
}

export const isSingleUnitQuantity = (value: string): boolean => !value.includes(QUANTITY_BREAKDOWN_SEPARATOR)

export const isNegativeSingleUnitQuantity = (value: string): boolean => isSingleUnitQuantity(value) && /^\s*[−-]/u.test(value)
