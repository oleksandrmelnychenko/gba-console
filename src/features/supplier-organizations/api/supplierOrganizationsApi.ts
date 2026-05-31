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

export async function getSupplyOrganizations(): Promise<SupplyOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all')

  return normalizeSupplyOrganizations(result)
}

export async function searchSupplyOrganizations(value: string, organizationNetId = ''): Promise<SupplyOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      organizationNetId,
      value,
    },
  })

  return normalizeSupplyOrganizations(result)
}

export async function getSupplyOrganization(netId: string): Promise<SupplyOrganization | null> {
  const result = await apiRequest<unknown>('/supplies/organizations/get', {
    query: {
      netId,
    },
  })

  return normalizeSupplyOrganization(result)
}

export async function createSupplyOrganization(organization: SupplyOrganization): Promise<SupplyOrganization | null> {
  const result = await apiRequest<unknown>('/supplies/organizations/new', {
    method: 'POST',
    body: organization,
  })

  return normalizeSupplyOrganization(result)
}

export async function updateSupplyOrganization(organization: SupplyOrganization): Promise<SupplyOrganization | null> {
  const result = await apiRequest<unknown>('/supplies/organizations/update', {
    method: 'POST',
    body: organization,
  })

  return normalizeSupplyOrganization(result)
}

export async function deleteSupplyOrganization(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/organizations/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function exportSupplyOrganizations(value: string): Promise<SupplyOrganizationDocumentExport> {
  const result = await apiRequest<unknown>('/supplies/organizations/document', {
    query: {
      value,
    },
  })

  return normalizeDocumentExport(result)
}

export async function createSupplyOrganizationAgreement(
  agreement: SupplyOrganizationAgreement,
  files: File[],
): Promise<SupplyOrganizationAgreement | null> {
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
  const result = await apiRequest<unknown>('/accounting/cashflow/get/filtered', {
    query: {
      from: params.from,
      netId: params.netId,
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
  if (!result || typeof result !== 'object') {
    return null
  }

  const organization = result as SupplyOrganization

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
  if (!result || typeof result !== 'object') {
    return null
  }

  const agreement = result as SupplyOrganizationAgreement

  return {
    ...agreement,
    SupplyOrganizationDocuments: Array.isArray(agreement.SupplyOrganizationDocuments)
      ? agreement.SupplyOrganizationDocuments
      : [],
  }
}

function normalizeDocumentExport(result: unknown): SupplyOrganizationDocumentExport {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function normalizeAccountingCashFlow(result: unknown): AccountingCashFlow {
  const payload = result && typeof result === 'object' ? (result as Partial<AccountingCashFlow>) : {}

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
