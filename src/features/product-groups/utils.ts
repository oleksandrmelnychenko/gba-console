import type { ProductGroup, ProductSubGroup } from './types'
import { translate } from '../../shared/i18n/translate'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const dateFormatter = new Intl.DateTimeFormat('uk-UA')

export function getEmptyGuid(): string {
  return EMPTY_GUID
}

export function createEmptyProductGroup(): ProductGroup {
  return {
    Description: '',
    FullName: '',
    IsActive: true,
    IsSubGroup: false,
    Name: '',
    ProductProductGroups: [],
    RootProductGroups: [],
    SubProductGroups: [],
  }
}

export function getProductGroupName(productGroup?: ProductGroup | null): string {
  return productGroup?.Name?.trim() || productGroup?.FullName?.trim() || translate('Без назви')
}

export function getProductGroupFullName(productGroup?: ProductGroup | null): string {
  return productGroup?.FullName?.trim() || productGroup?.Name?.trim() || translate('Без назви')
}

export function getCurrentRootProductGroup(productGroup?: ProductGroup | null): ProductGroup | null {
  const rootRelation = getCurrentRootRelation(productGroup)

  return rootRelation?.RootProductGroup || productGroup?.RootProductGroup || null
}

export function getCurrentRootProductGroupName(productGroup?: ProductGroup | null): string {
  return displayValue(
    getCurrentRootProductGroup(productGroup)?.Name ||
      productGroup?.RootProductGroupName ||
      productGroup?.RootProductGroup?.Name,
  )
}

export function buildRootProductGroupChanges(
  productGroup: ProductGroup,
  selectedRootProductGroup: ProductGroup | null,
): ProductSubGroup[] {
  const currentRootRelation = getCurrentRootRelation(productGroup)
  const currentRootNetUid =
    currentRootRelation?.RootProductGroup?.NetUid || productGroup.RootProductGroup?.NetUid || null
  const selectedRootNetUid = selectedRootProductGroup?.NetUid || null

  if (currentRootNetUid === selectedRootNetUid) {
    return []
  }

  const changes: ProductSubGroup[] = []

  if (currentRootRelation) {
    changes.push({
      ...currentRootRelation,
      Deleted: true,
    })
  }

  if (selectedRootProductGroup) {
    changes.push({
      RootProductGroup: selectedRootProductGroup,
    })
  }

  return changes
}

export function normalizeProductGroupForSave(
  productGroup: ProductGroup,
  rootProductGroups: ProductSubGroup[],
): ProductGroup {
  const name = productGroup.Name?.trim() || ''
  const fullName = productGroup.FullName?.trim() || name
  const description = productGroup.Description?.trim() || ''

  return {
    ...productGroup,
    Description: description,
    FullName: fullName,
    IsActive: productGroup.IsActive !== false,
    IsSubGroup: rootProductGroups.some((rootProductGroup) => rootProductGroup.Deleted !== true)
      ? true
      : rootProductGroups.some((rootProductGroup) => rootProductGroup.Deleted === true)
        ? false
        : productGroup.IsSubGroup,
    Name: name,
    ProductProductGroups: [],
    RootProductGroups: rootProductGroups,
    SubProductGroups: [],
  }
}

export function validateProductGroup(productGroup: ProductGroup): string | null {
  if (!productGroup.Name?.trim()) {
    return translate('Вкажіть назву групи')
  }

  return null
}

export function displayValue(value?: boolean | number | string | null): string {
  if (typeof value === 'boolean') {
    return value ? translate('Так') : translate('Ні')
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}

export function formatProductGroupDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : parseProductGroupDate(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateFormatter.format(date)
}

function parseProductGroupDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)

    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function getCurrentRootRelation(productGroup?: ProductGroup | null): ProductSubGroup | null {
  return (
    productGroup?.RootProductGroups?.find(
      (rootProductGroup) => rootProductGroup.Deleted !== true && Boolean(rootProductGroup.RootProductGroup),
    ) || null
  )
}
