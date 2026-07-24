import { apiRequest } from '../../../shared/api/apiClient'
import type { AccountingCashFlow } from '../../accounting-cash-flow/types'
import type {
  Currency,
  Organization,
  SupplierOrganizationCashFlowSearchParams,
  SupplyOrganization,
  SupplyOrganizationAgreement,
  SupplyOrganizationDocumentExport,
} from '../types'
import { hasSupplierOrganizationEntityIdentity } from '../validation'

export type SupplyOrganizationsListFilters = {
  from?: string
  to?: string
}

export type SupplyOrganizationsListParams = SupplyOrganizationsListFilters & {
  limit?: number
  offset?: number
}

export async function getSupplyOrganizations(params: SupplyOrganizationsListParams = {}): Promise<SupplyOrganization[]> {
  assertListParams(params)

  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
      value: '',
    },
  })

  return normalizeSupplyOrganizations(result)
}

export async function searchSupplyOrganizations(
  value: string,
  organizationNetId = '',
  params: SupplyOrganizationsListParams = {},
): Promise<SupplyOrganization[]> {
  assertListParams(params)
  const searchValue = value.trim()

  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      organizationNetId: organizationNetId.trim(),
      to: params.to,
      value: searchValue,
    },
  })

  return normalizeSupplyOrganizations(result)
}

export async function getSupplyOrganization(netId: string): Promise<SupplyOrganization | null> {
  const normalizedNetId = requireIdentifier(netId, 'постачальника')
  const result = await apiRequest<unknown>('/supplies/organizations/get', {
    query: {
      netId: normalizedNetId,
    },
  })

  return normalizeSupplyOrganization(result)
}

export async function createSupplyOrganization(organization: SupplyOrganization): Promise<SupplyOrganization | null> {
  assertSupplyOrganizationPayload(organization, false)
  const result = await apiRequest<unknown>('/supplies/organizations/new', {
    method: 'POST',
    body: organization,
  })

  return normalizeSupplyOrganization(result)
}

export async function updateSupplyOrganization(organization: SupplyOrganization): Promise<SupplyOrganization | null> {
  assertSupplyOrganizationPayload(organization, true)
  const result = await apiRequest<unknown>('/supplies/organizations/update', {
    method: 'POST',
    body: organization,
  })

  return normalizeSupplyOrganization(result)
}

export async function deleteSupplyOrganization(netId: string): Promise<void> {
  const normalizedNetId = requireIdentifier(netId, 'постачальника')
  await apiRequest<unknown>('/supplies/organizations/delete', {
    method: 'DELETE',
    query: {
      netId: normalizedNetId,
    },
  })
}

export async function exportSupplyOrganizations(
  value: string,
  filters: SupplyOrganizationsListFilters = {},
): Promise<SupplyOrganizationDocumentExport> {
  assertListParams(filters)
  const result = await apiRequest<unknown>('/supplies/organizations/document', {
    query: {
      from: filters.from,
      to: filters.to,
      value: value.trim(),
    },
  })

  return normalizeDocumentExport(result)
}

export async function createSupplyOrganizationAgreement(
  agreement: SupplyOrganizationAgreement,
  files: File[],
): Promise<SupplyOrganizationAgreement | null> {
  assertSupplyOrganizationAgreementPayload(agreement, false)
  const result = await apiRequest<unknown>('/supplies/organizations/agreement/new', {
    method: 'POST',
    body: buildAgreementFormData(agreement, files),
  })

  return normalizeSupplyOrganizationAgreement(result)
}

export async function updateSupplyOrganizationAgreement(
  agreement: SupplyOrganizationAgreement,
  files: File[] = [],
): Promise<SupplyOrganizationAgreement | null> {
  assertSupplyOrganizationAgreementPayload(agreement, true)
  const result = await apiRequest<unknown>('/supplies/organizations/agreement/update', {
    method: 'POST',
    body: buildAgreementFormData(agreement, files),
  })

  return normalizeSupplyOrganizationAgreement(result)
}

export async function getSupplierOrganizationCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getSupplierOrganizationsOwners(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Data']) as Organization[]
}

export async function getSupplierOrganizationCashFlow(
  params: SupplierOrganizationCashFlowSearchParams,
): Promise<AccountingCashFlow> {
  const normalizedNetId = requireIdentifier(params.netId, 'постачальника або договору')
  assertDateRange(params.from, params.to)

  if (!Number.isInteger(params.typePaymentTask) || params.typePaymentTask < 0) {
    throw new RangeError('Тип платіжного завдання має бути невід’ємним цілим числом')
  }

  const result = await apiRequest<unknown>('/accounting/cashflow/get/filtered', {
    query: {
      from: params.from,
      netId: normalizedNetId,
      to: params.to,
      typePaymentTask: params.typePaymentTask,
    },
  })

  return normalizeAccountingCashFlow(result)
}

function buildAgreementFormData(agreement: SupplyOrganizationAgreement, files: File[]): FormData {
  const formData = new FormData()
  formData.append('agreementInString', JSON.stringify(agreement))

  files.forEach((file) => formData.append('files', file))

  return formData
}

function normalizeSupplyOrganizations(result: unknown): SupplyOrganization[] {
  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data'])
    .map(normalizeSupplyOrganization)
    .filter((organization): organization is SupplyOrganization => Boolean(organization))
}

function normalizeSupplyOrganization(result: unknown): SupplyOrganization | null {
  const organization = readObjectPayload<SupplyOrganization>(
    result,
    ['Item', 'SupplyOrganization', 'Organization', 'Data'],
  )

  if (!organization) {
    return null
  }

  if (!hasSupplierOrganizationEntityIdentity(organization) && typeof organization.Name !== 'string') {
    return null
  }

  return {
    ...organization,
    SupplyOrganizationAgreements: Array.isArray(organization.SupplyOrganizationAgreements)
      ? organization.SupplyOrganizationAgreements
          .map(normalizeSupplyOrganizationAgreement)
          .filter((agreement): agreement is SupplyOrganizationAgreement => Boolean(agreement))
      : [],
  }
}

function normalizeSupplyOrganizationAgreement(result: unknown): SupplyOrganizationAgreement | null {
  const agreement = readObjectPayload<SupplyOrganizationAgreement>(
    result,
    ['Item', 'Agreement', 'SupplyOrganizationAgreement', 'Data'],
  )

  if (!agreement) {
    return null
  }

  if (!hasSupplierOrganizationEntityIdentity(agreement) && typeof agreement.Name !== 'string') {
    return null
  }

  return {
    ...agreement,
    SupplyOrganizationDocuments: Array.isArray(agreement.SupplyOrganizationDocuments)
      ? agreement.SupplyOrganizationDocuments
      : [],
  }
}

function normalizeDocumentExport(result: unknown): SupplyOrganizationDocumentExport {
  const payload = readObjectPayload<Record<string, unknown>>(result, ['Item', 'Document', 'Data'])

  if (!payload) {
    return {}
  }

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function normalizeAccountingCashFlow(result: unknown): AccountingCashFlow {
  const payload = readObjectPayload<Partial<AccountingCashFlow>>(result, ['Item', 'CashFlow', 'Data']) || {}

  return {
    ...payload,
    AccountingCashFlowHeadItems: Array.isArray(payload.AccountingCashFlowHeadItems)
      ? payload.AccountingCashFlowHeadItems
      : [],
  }
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function readObjectPayload<TObject extends object>(
  result: unknown,
  keys: string[],
): TObject | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    const nested = payload[key]

    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as TObject
    }
  }

  return payload as TObject
}

function assertListParams(params: SupplyOrganizationsListParams): void {
  if (typeof params.limit !== 'undefined' && (!Number.isInteger(params.limit) || params.limit <= 0)) {
    throw new RangeError('Ліміт має бути додатним цілим числом')
  }

  if (typeof params.offset !== 'undefined' && (!Number.isInteger(params.offset) || params.offset < 0)) {
    throw new RangeError('Зміщення має бути невід’ємним цілим числом')
  }

  if (params.from || params.to) {
    assertDateRange(params.from || '', params.to || '')
  }
}

function assertSupplyOrganizationPayload(organization: SupplyOrganization, requiresIdentity: boolean): void {
  if (!organization.Name?.trim()) {
    throw new Error('Вкажіть назву постачальника послуг')
  }

  if (requiresIdentity && !hasSupplierOrganizationEntityIdentity(organization)) {
    throw new Error('Постачальник не має ідентифікатора для оновлення')
  }
}

function assertSupplyOrganizationAgreementPayload(
  agreement: SupplyOrganizationAgreement,
  requiresIdentity: boolean,
): void {
  if (!agreement.Name?.trim()) {
    throw new Error('Вкажіть назву договору')
  }

  if (!Number.isInteger(agreement.SupplyOrganizationId) || Number(agreement.SupplyOrganizationId) <= 0) {
    throw new Error('Договір не прив’язано до постачальника послуг')
  }

  if (!hasSupplierOrganizationEntityIdentity(agreement.Organization)) {
    throw new Error('Оберіть організацію договору')
  }

  if (!hasSupplierOrganizationEntityIdentity(agreement.Currency)) {
    throw new Error('Оберіть валюту договору')
  }

  if (requiresIdentity && !hasSupplierOrganizationEntityIdentity(agreement)) {
    throw new Error('Договір не має ідентифікатора для оновлення')
  }

  assertDateRange(agreement.ExistFrom || '', agreement.ExistTo || '')
}

function assertDateRange(from: string, to: string): void {
  const normalizedFrom = normalizeDateForComparison(from)
  const normalizedTo = normalizeDateForComparison(to)

  if (from && !normalizedFrom) {
    throw new Error('Некоректна дата початку')
  }

  if (to && !normalizedTo) {
    throw new Error('Некоректна дата завершення')
  }

  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    throw new Error('Дата завершення не може бути раніше дати початку')
  }
}

function requireIdentifier(value: string, entityName: string): string {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new Error(`Не вказано ідентифікатор ${entityName}`)
  }

  return normalizedValue
}

function normalizeDateForComparison(value: string): string | null {
  if (!value) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    return (
      date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
    ) ? date.toISOString() : null
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}
