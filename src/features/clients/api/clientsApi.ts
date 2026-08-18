import { apiRequest } from '../../../shared/api/apiClient'
import type { ServerBooleanFilter } from '../../../shared/api/searchQuery'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import type {
  Client,
  ClientCommercialCard,
  ClientCommercialLegalParty,
  ClientCommercialStructure,
  ClientSourceCardSnapshot,
  ClientSourceQualitySummary,
  ClientFilterItem,
  ClientIdentityAttentionSummary,
  ClientIdentityMutationKind,
  ClientIdentityMutationRequest,
  ClientIdentityMutationResult,
  ClientPrintDocument,
  ClientSearchParams,
  ClientType,
} from '../types'

const CLIENT_SEARCH_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'
const SUPPLIER_SEARCH_SQL = 'RegionCode.Value/Client.FullName'
const CLIENT_FILTER_ENTITY_TYPE_CLIENT = 0
const CLIENT_FILTER_ENTITY_TYPE_SUPPLIER = 7
const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1

export async function getClients(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  return getClientsFromRoute('/clients/all/filtered', params, signal)
}

export async function getClientsForRegistry(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  return getClientsFromRoute('/clients/registry/all/filtered', params, signal)
}

export async function getClientsForStructure(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  return getClientsFromRoute('/clients/structure/registry', params, signal)
}

async function getClientsFromRoute(
  route: string,
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  const result = await apiRequest<unknown>(route, {
    query: {
      active: params.active,
      filterSql: params.filterSql || CLIENT_SEARCH_SQL,
      ...(params.forReSale !== null && typeof params.forReSale !== 'undefined'
        ? { forReSale: params.forReSale }
        : {}),
      limit: params.limit,
      offset: params.offset,
      typeRoleFilter: params.typeRoleFilter,
      value: params.value?.trim() || '',
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeClients(result)
}

export async function getSuppliers(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/suppliers/registry/all/filtered', {
    query: {
      active: params.active,
      filterSql: params.filterSql || SUPPLIER_SEARCH_SQL,
      limit: params.limit,
      offset: params.offset,
      typeRoleFilter: params.typeRoleFilter,
      value: params.value?.trim() || '',
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeClients(result)
}

export async function getClientCount(type = CLIENT_TYPE_BUYER): Promise<number> {
  const result = await apiRequest<unknown>('/clients/get/total', {
    query: {
      type,
    },
  })

  return normalizeCount(result)
}

export async function getSupplierCount(): Promise<number> {
  const result = await apiRequest<unknown>('/clients/suppliers/registry/total', {
    query: { type: CLIENT_TYPE_PROVIDER },
  })

  return normalizeCount(result)
}

export async function getClientTypes(): Promise<ClientType[]> {
  const result = await apiRequest<unknown>('/clients/types/all')

  return Array.isArray(result) ? (result as ClientType[]) : []
}

export async function getClientIdentityAttention(
  clientNetId: string,
  signal?: AbortSignal,
): Promise<ClientIdentityAttentionSummary | null> {
  const result = await apiRequest<unknown>('/clients/get/identity-attention', {
    query: { netId: clientNetId },
    ...(signal ? { signal } : {}),
  })

  return isIdentityAttentionSummary(result)
    ? result
    : null
}

export async function getClientIdentityAttentionBatch(
  clientNetIds: string[],
  signal?: AbortSignal,
): Promise<ClientIdentityAttentionSummary[]> {
  const normalizedIds = [...new Set(clientNetIds.filter(Boolean))].slice(0, 100)
  if (normalizedIds.length === 0) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/get/identity-attention/batch', {
    method: 'POST',
    body: normalizedIds,
    ...(signal ? { signal } : {}),
  })

  return Array.isArray(result)
    ? result.filter(isIdentityAttentionSummary)
    : []
}

export async function getClientIdentityAttentionBatchForRegistry(
  clientNetIds: string[],
  signal?: AbortSignal,
): Promise<ClientIdentityAttentionSummary[]> {
  const normalizedIds = [...new Set(clientNetIds.filter(Boolean))].slice(0, 100)
  if (normalizedIds.length === 0) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/registry/identity-attention/batch', {
    method: 'POST',
    body: normalizedIds,
    ...(signal ? { signal } : {}),
  })

  return Array.isArray(result)
    ? result.filter(isIdentityAttentionSummary)
    : []
}

export async function getClientCommercialStructure(
  clientNetId: string,
  signal?: AbortSignal,
): Promise<ClientCommercialStructure | null> {
  const result = await apiRequest<unknown>('/clients/get/commercial-structure', {
    query: { netId: clientNetId },
    ...(signal ? { signal } : {}),
  })

  return isClientCommercialStructure(result) ? result : null
}

export async function getClientCommercialStructureForRegistry(
  clientNetId: string,
  signal?: AbortSignal,
): Promise<ClientCommercialStructure | null> {
  const result = await apiRequest<unknown>('/clients/structure/details', {
    query: { netId: clientNetId },
    ...(signal ? { signal } : {}),
  })

  return isClientCommercialStructure(result) ? result : null
}

export async function mutateClientIdentity(
  kind: ClientIdentityMutationKind,
  request: ClientIdentityMutationRequest,
): Promise<ClientIdentityMutationResult> {
  const result = await apiRequest<ClientIdentityMutationResult>(`/clients/identity-links/${kind}`, {
    method: 'POST',
    body: request,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })

  if (!result || typeof result !== 'object' || typeof result.ClientNetUid !== 'string') {
    throw new Error('Сервер повернув некоректний результат зміни зв’язку клієнтів')
  }

  return result
}

export async function mutateClientIdentityForStructure(
  kind: ClientIdentityMutationKind,
  request: ClientIdentityMutationRequest,
): Promise<ClientIdentityMutationResult> {
  const result = await apiRequest<ClientIdentityMutationResult>(`/clients/structure/identity-links/${kind}`, {
    method: 'POST',
    body: request,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })

  if (!result || typeof result !== 'object' || typeof result.ClientNetUid !== 'string') {
    throw new Error('Сервер повернув некоректний результат зміни зв’язку клієнтів')
  }

  return result
}

export async function getClientSourceQualityBatch(
  clientNetIds: string[],
  signal?: AbortSignal,
): Promise<ClientSourceQualitySummary[]> {
  const normalizedIds = [...new Set(clientNetIds.filter(Boolean))].slice(0, 100)
  if (normalizedIds.length === 0) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/get/source-quality/batch', {
    method: 'POST',
    body: normalizedIds,
    ...(signal ? { signal } : {}),
  })

  return Array.isArray(result)
    ? result.filter(isClientSourceQualitySummary)
    : []
}

export async function getClientSourceQualityBatchForRegistry(
  clientNetIds: string[],
  signal?: AbortSignal,
): Promise<ClientSourceQualitySummary[]> {
  const normalizedIds = [...new Set(clientNetIds.filter(Boolean))].slice(0, 100)
  if (normalizedIds.length === 0) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/registry/source-quality/batch', {
    method: 'POST',
    body: normalizedIds,
    ...(signal ? { signal } : {}),
  })

  return Array.isArray(result)
    ? result.filter(isClientSourceQualitySummary)
    : []
}

export async function getClientFilterItems(): Promise<ClientFilterItem[]> {
  return getFilterItems(CLIENT_FILTER_ENTITY_TYPE_CLIENT)
}

export async function getSupplierFilterItems(): Promise<ClientFilterItem[]> {
  return getFilterItems(CLIENT_FILTER_ENTITY_TYPE_SUPPLIER)
}

async function getFilterItems(type: number): Promise<ClientFilterItem[]> {
  const result = await apiRequest<unknown>('/filteritems/all', {
    query: {
      type,
    },
  })

  return normalizeFilterItems(result)
}

export async function exportClientsDocument(params: ClientSearchParams): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/clients/document', {
    query: {
      filter: buildClientsSearchFilter(params),
    },
  })

  return normalizeDocument(result)
}

export async function exportClientsDocumentForRegistry(
  params: ClientSearchParams,
): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/clients/registry/document/export', {
    query: {
      filter: buildClientsSearchFilter(params),
    },
  })

  return normalizeDocument(result)
}

export async function exportSuppliersDocument(params: ClientSearchParams): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/clients/suppliers/document/export', {
    query: {
      filter: buildClientsSearchFilter({
        ...params,
        filterEntityType: params.filterEntityType ?? CLIENT_FILTER_ENTITY_TYPE_SUPPLIER,
      }),
    },
  })

  return normalizeDocument(result)
}

export async function switchClientActiveState(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/switch/active', {
    query: {
      netId,
    },
  })
}

export async function switchClientActiveStateForRegistry(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/registry/switch/active', {
    query: {
      netId,
    },
  })
}

export async function updateClientOrderExpireDays(clientNetId: string, days: number): Promise<void> {
  await apiRequest<unknown>('/clients/update/order/expire', {
    method: 'POST',
    query: {
      clientNetId,
      days,
    },
    body: {},
  })
}

export async function updateClientOrderExpireDaysForRegistry(
  clientNetId: string,
  days: number,
): Promise<void> {
  await apiRequest<unknown>('/clients/registry/reservation-days', {
    method: 'POST',
    query: {
      clientNetId,
      days,
    },
    body: {},
  })
}

export function buildClientsSearchFilter(params: ClientSearchParams): string {
  const searchValue = params.value?.trim() || ''
  const booleanFilter = buildActiveFilter(params.active)
  const filterEntityType = params.filterEntityType ?? CLIENT_FILTER_ENTITY_TYPE_CLIENT
  const hasSortDescriptors = Boolean(params.sortDescriptors?.length)
  const hasScopedFilters = Boolean(
    booleanFilter
      || params.typeRoleFilter
      || hasSortDescriptors
      || params.forReSale !== null && typeof params.forReSale !== 'undefined'
      || filterEntityType !== CLIENT_FILTER_ENTITY_TYPE_CLIENT,
  )
  const shouldSendFilter = Boolean(searchValue || hasScopedFilters)

  return buildServerSearchFilter({
    table: 'Client',
    offset: params.offset,
    limit: params.limit,
    value: searchValue,
    filterEntityType,
    filterSql: shouldSendFilter ? params.filterSql || CLIENT_SEARCH_SQL : undefined,
    filterOperationSql: params.filterOperationSql,
    booleanFilter,
    sortDescriptors: params.sortDescriptors,
    typeRoleFilter: params.typeRoleFilter,
    extra: {
      forReSale: params.forReSale ?? null,
    },
  })
}

function normalizeClients(result: unknown): Client[] {
  if (Array.isArray(result)) {
    return result as Client[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as Client[]
  }

  return []
}

function normalizeDocument(result: unknown): ClientPrintDocument | null {
  if (result && typeof result === 'object') {
    return result as ClientPrintDocument
  }

  return null
}

function normalizeFilterItems(result: unknown): ClientFilterItem[] {
  if (Array.isArray(result)) {
    return result as ClientFilterItem[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as ClientFilterItem[]
  }

  return []
}

function normalizeCount(result: unknown): number {
  if (typeof result === 'number') {
    return parseCount(result)
  }

  if (typeof result === 'string') {
    return parseCount(result)
  }

  if (result && typeof result === 'object') {
    const count = (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Count
      ?? (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Total
      ?? (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Value

    return parseCount(count)
  }

  return 0
}

function isIdentityAttentionSummary(
  value: unknown,
): value is ClientIdentityAttentionSummary {
  if (!value || typeof value !== 'object') {
    return false
  }

  const summary = value as Partial<ClientIdentityAttentionSummary>
  return typeof summary.ClientNetUid === 'string'
    && typeof summary.AsOfUtc === 'string'
    && ['none', 'info', 'warning', 'critical'].includes(String(summary.AttentionLevel))
    && typeof summary.RequiresReview === 'boolean'
    && typeof summary.HasCreditRiskSignal === 'boolean'
    && typeof summary.HasOwnOverdueDebt === 'boolean'
    && typeof summary.HasRelatedOverdueDebt === 'boolean'
    && typeof summary.IsTargetBlocked === 'boolean'
    && typeof summary.HasRelatedBlockedCard === 'boolean'
    && typeof summary.OwnMaxOverdueDays === 'number'
    && typeof summary.RelatedMaxOverdueDays === 'number'
    && Array.isArray(summary.AttentionReasons)
    && Array.isArray(summary.Candidates)
    && Array.isArray(summary.OverdueByCurrency)
}

function isClientCommercialStructure(
  value: unknown,
): value is ClientCommercialStructure {
  if (!value || typeof value !== 'object') {
    return false
  }

  const structure = value as Partial<ClientCommercialStructure>
  return typeof structure.ClientNetUid === 'string'
    && typeof structure.AsOfUtc === 'string'
    && ['self', 'confirmed', 'probable', 'review_required'].includes(String(structure.State))
    && typeof structure.RequiresReview === 'boolean'
    && typeof structure.IsPartial === 'boolean'
    && typeof structure.CardCount === 'number'
    && typeof structure.AgreementCount === 'number'
    && typeof structure.ActiveAgreementCount === 'number'
    && typeof structure.SaleCount === 'number'
    && Array.isArray(structure.Reasons)
    && structure.Reasons.every((reason) => typeof reason === 'string')
    && Array.isArray(structure.LegalParties)
    && structure.LegalParties.every(isClientCommercialLegalParty)
}

function isClientCommercialLegalParty(
  value: unknown,
): value is ClientCommercialLegalParty {
  if (!value || typeof value !== 'object') {
    return false
  }
  const party = value as Partial<ClientCommercialLegalParty>
  return typeof party.Key === 'string'
    && ['self', 'confirmed', 'probable', 'review_required'].includes(String(party.State))
    && typeof party.IsTarget === 'boolean'
    && typeof party.RequiresReview === 'boolean'
    && typeof party.AgreementCount === 'number'
    && typeof party.ActiveAgreementCount === 'number'
    && typeof party.SaleCount === 'number'
    && Array.isArray(party.Reasons)
    && party.Reasons.every((reason) => typeof reason === 'string')
    && Array.isArray(party.Cards)
    && party.Cards.every(isClientCommercialCard)
}

function isClientCommercialCard(value: unknown): value is ClientCommercialCard {
  if (!value || typeof value !== 'object') {
    return false
  }
  const card = value as Partial<ClientCommercialCard>
  return typeof card.ClientId === 'number'
    && typeof card.ClientNetUid === 'string'
    && typeof card.IsSubClient === 'boolean'
    && typeof card.IsTradePoint === 'boolean'
    && typeof card.IsActive === 'boolean'
    && typeof card.IsBlocked === 'boolean'
    && typeof card.IsTarget === 'boolean'
    && typeof card.HasExplicitRelationship === 'boolean'
    && typeof card.AgreementCount === 'number'
    && typeof card.ActiveAgreementCount === 'number'
    && typeof card.SaleCount === 'number'
    && Array.isArray(card.Reasons)
    && card.Reasons.every((reason) => typeof reason === 'string')
    && Array.isArray(card.SourceSnapshots)
    && card.SourceSnapshots.every(isClientSourceCardSnapshot)
}

function isClientSourceCardSnapshot(
  value: unknown,
): value is ClientSourceCardSnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }
  const snapshot = value as Partial<ClientSourceCardSnapshot>
  return typeof snapshot.SourceSystem === 'string'
    && typeof snapshot.SourceCode === 'number'
    && isOptionalString(snapshot.BankName)
    && isOptionalString(snapshot.BankAccountNumber)
    && isOptionalString(snapshot.BankCurrencyCode)
    && isOptionalString(snapshot.MainContactPersonName)
    && isOptionalString(snapshot.MainContactPersonPosition)
    && isOptionalString(snapshot.ManagerName)
    && isOptionalNumber(snapshot.QuantityDayDebt)
    && isOptionalBoolean(snapshot.IsControlDayDebt)
    && (snapshot.Contacts == null
      || Array.isArray(snapshot.Contacts) && snapshot.Contacts.every(isClientSourceContactSnapshot))
    && (snapshot.Agreements == null
      || Array.isArray(snapshot.Agreements) && snapshot.Agreements.every(isClientSourceAgreementSnapshot))
    && typeof snapshot.SourceMarkedDeleted === 'boolean'
    && typeof snapshot.SourceIdentityValid === 'boolean'
    && typeof snapshot.EvidenceTruncated === 'boolean'
    && typeof snapshot.LastSeenAtUtc === 'string'
}

function isClientSourceContactSnapshot(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const contact = value as Record<string, unknown>
  return isOptionalString(contact.AddressType)
    && isOptionalString(contact.InfoType)
    && isOptionalString(contact.SourceAddressKindCode)
    && isOptionalString(contact.Value)
    && typeof contact.IsUnclassified === 'boolean'
}

function isClientSourceAgreementSnapshot(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const agreement = value as Record<string, unknown>
  return typeof agreement.SourceCode === 'number'
    && isOptionalString(agreement.Name)
    && isOptionalString(agreement.Number)
    && isOptionalString(agreement.CurrencyCode)
    && typeof agreement.PermissibleDebtAmount === 'number'
    && typeof agreement.DebtDaysAllowedNumber === 'number'
    && isOptionalString(agreement.OrganizationName)
    && isOptionalString(agreement.TypePriceName)
    && isOptionalString(agreement.PromotionalTypePriceName)
    && isOptionalString(agreement.AgreementType)
    && isOptionalString(agreement.FromDate)
    && isOptionalString(agreement.ToDate)
    && typeof agreement.IsManagementAccounting === 'boolean'
    && typeof agreement.IsAccounting === 'boolean'
    && typeof agreement.SourceMarkedDeleted === 'boolean'
}

function isOptionalString(value: unknown): boolean {
  return value == null || typeof value === 'string'
}

function isOptionalNumber(value: unknown): boolean {
  return value == null || typeof value === 'number' && Number.isFinite(value)
}

function isOptionalBoolean(value: unknown): boolean {
  return value == null || typeof value === 'boolean'
}

function isClientSourceQualitySummary(
  value: unknown,
): value is ClientSourceQualitySummary {
  if (!value || typeof value !== 'object') {
    return false
  }
  const summary = value as Partial<ClientSourceQualitySummary>
  const state = String(summary.State)
  const snapshotCount = summary.SourceSnapshotCount
  const systemCount = summary.SourceSystemCount
  const hasValidCounts = Number.isInteger(snapshotCount)
    && Number.isInteger(systemCount)
    && Number(snapshotCount) >= 0
    && Number(systemCount) >= 0
    && Number(systemCount) <= Number(snapshotCount)
  const hasConsistentState = state === 'not_synced'
    ? snapshotCount === 0 && summary.RequiresReview === false
    : state === 'clean'
      ? Number(snapshotCount) > 0 && summary.RequiresReview === false
      : state === 'review_required'
        && Number(snapshotCount) > 0
        && summary.RequiresReview === true

  return typeof summary.ClientNetUid === 'string'
    && typeof summary.AsOfUtc === 'string'
    && ['not_synced', 'clean', 'review_required'].includes(state)
    && typeof summary.RequiresReview === 'boolean'
    && hasValidCounts
    && hasConsistentState
    && typeof summary.HasFenixSnapshot === 'boolean'
    && typeof summary.HasAmgSnapshot === 'boolean'
    && (summary.LastSeenAtUtc == null || typeof summary.LastSeenAtUtc === 'string')
    && Array.isArray(summary.Reasons)
    && summary.Reasons.every((reason) => typeof reason === 'string')
}

function parseCount(count: unknown): number {
  if (typeof count === 'number') {
    return Number.isFinite(count) ? count : 0
  }

  if (typeof count === 'string') {
    const parsed = Number(count)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function buildActiveFilter(active?: boolean | null): ServerBooleanFilter | null {
  if (active === null || typeof active === 'undefined') {
    return null
  }

  return {
    CssClass: active ? 'active_clients' : 'inactive_clients',
    Name: active ? 'ShowOnlyActive' : 'ShowOnlyInactive',
    SQL: 'IsActive',
    Value: active,
  }
}
