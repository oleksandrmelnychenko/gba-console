import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { Client, ClientSearchParams } from '../types'
import {
  buildClientsSearchFilter,
  exportClientsDocument,
  exportClientsDocumentForRegistry,
  exportSuppliersDocument,
  getClientCount,
  getClientCommercialStructure,
  getClientCommercialStructureForRegistry,
  getClientFilterItems,
  getClientIdentityAttention,
  getClientIdentityAttentionBatch,
  getClientIdentityAttentionBatchForRegistry,
  getClientSourceQualityBatch,
  getClientSourceQualityBatchForRegistry,
  getClients,
  getClientsForRegistry,
  getClientsForStructure,
  getSupplierCount,
  getSupplierFilterItems,
  getSuppliers,
  mutateClientIdentity,
  mutateClientIdentityForStructure,
  normalizeClientSearchValue,
  switchClientActiveState,
  switchClientActiveStateForRegistry,
  updateClientOrderExpireDays,
  updateClientOrderExpireDaysForRegistry,
} from './clientsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

type SerializedClientSearchPayload = {
  BooleanFilter: string
  Filter: string
  Limit: number
  Offset: number
  SortDescriptors: unknown[]
  Table: string
  TypeRoleFilter: string
  forReSale: boolean | null
}

function parseClientSearchPayload(value: string): SerializedClientSearchPayload {
  return JSON.parse(value) as SerializedClientSearchPayload
}

describe('buildClientsSearchFilter', () => {
  it('builds the default clients search filter expected by the server', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 10,
      limit: 25,
      value: '  Ivanenko  ',
      active: true,
      forReSale: false,
      typeRoleFilter: 'ClientTypeRole.Id = 3',
    }))

    expect(payload.Table).toBe('Client')
    expect(payload.Offset).toBe(10)
    expect(payload.Limit).toBe(25)
    expect(payload.TypeRoleFilter).toBe('ClientTypeRole.Id = 3')
    expect(payload.SortDescriptors).toEqual([])
    expect(payload.forReSale).toBe(false)
    expect(JSON.parse(payload.BooleanFilter)).toEqual({
      CssClass: 'active_clients',
      Name: 'ShowOnlyActive',
      SQL: 'IsActive',
      Value: true,
    })
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Ivanenko',
      FilterItem: {
        Type: 0,
        SQL: 'RegionCode.Value/Client.FullName/Client.USREOU',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
  })

  it('serializes inactive and unscoped resale filters explicitly', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      active: false,
      forReSale: null,
    }))

    expect(payload.forReSale).toBeNull()
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: '',
      FilterItem: {
        Type: 0,
        SQL: 'RegionCode.Value/Client.FullName/Client.USREOU',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
    expect(JSON.parse(payload.BooleanFilter)).toEqual({
      CssClass: 'inactive_clients',
      Name: 'ShowOnlyInactive',
      SQL: 'IsActive',
      Value: false,
    })
  })

  it('omits the server search filter for the default unfiltered client list', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 30,
      active: null,
      forReSale: null,
    }))

    expect(payload.Filter).toBe('')
  })

  it('omits the server search filter for whitespace-only default search values', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 30,
      filterSql: 'Client.FullName',
      value: '   ',
    }))

    expect(payload.Filter).toBe('')
  })

  it('passes supplier filter entity type through the server filter item', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      filterEntityType: 7,
      filterSql: 'Client.FullName',
      value: 'Provider',
    }))

    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Provider',
      FilterItem: {
        Type: 7,
        SQL: 'Client.FullName',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
  })

  it('serializes filter operations and server sort descriptors', () => {
    const payload = parseClientSearchPayload(buildClientsSearchFilter({
      offset: 0,
      limit: 20,
      filterOperationSql: 'StartsWith',
      filterSql: 'Client.FullName',
      sortDescriptors: [{ Column: 'FullName', Dir: 'desc' }],
      value: 'Acme',
    }))

    expect(payload.SortDescriptors).toEqual([{ Column: 'FullName', Dir: 'desc' }])
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Acme',
      FilterItem: {
        Type: 0,
        SQL: 'Client.FullName',
        FilterOperationItem: {
          SQL: 'StartsWith',
        },
      },
    })
  })
})

describe('normalizeClientSearchValue', () => {
  it.each([
    ['хм0', 'XM0'],
    ['ХМ052', 'XM052'],
    ['Bхм05200', 'BXM05200'],
  ])('folds the code-shaped mixed-script query %s to %s', (source, expected) => {
    expect(normalizeClientSearchValue(source)).toBe(expected)
  })

  it.each([
    'Хмельницький 2026',
    'ЖА1',
    'Іваненко',
    'XM052',
  ])('leaves a non-confusable or ordinary search value unchanged: %s', (value) => {
    expect(normalizeClientSearchValue(value)).toBe(value)
  })
})

describe('clients API query contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests clients through the targeted clients endpoint', async () => {
    const client: Client = { NetUid: 'client-1', FullName: 'Ivanenko' }
    const params: ClientSearchParams = {
      offset: 0,
      limit: 20,
      value: 'Ivanenko',
      active: null,
      forReSale: null,
      filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
      typeRoleFilter: '1',
    }

    apiRequestMock.mockResolvedValueOnce({ Items: [client] })

    await expect(getClients(params)).resolves.toEqual([client])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        active: null,
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        limit: 20,
        offset: 0,
        typeRoleFilter: '1',
        value: 'Ivanenko',
      },
    })
  })

  it('uses the permission-scoped registry endpoint for the clients page', async () => {
    const client: Client = { NetUid: 'client-1', FullName: 'Ivanenko' }
    const params: ClientSearchParams = {
      offset: 0,
      limit: 20,
      value: 'Ivanenko',
      active: null,
      forReSale: null,
      typeRoleFilter: '1',
    }

    apiRequestMock.mockResolvedValueOnce([client])

    await expect(getClientsForRegistry(params)).resolves.toEqual([client])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/registry/all/filtered', {
      query: {
        active: null,
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        limit: 20,
        offset: 0,
        typeRoleFilter: '1',
        value: 'Ivanenko',
      },
    })
  })

  it('normalizes a Cyrillic client code before requesting the targeted endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await expect(getClients({ limit: 50, offset: 0, value: '  хм0  ' })).resolves.toEqual([])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        active: undefined,
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        limit: 50,
        offset: 0,
        typeRoleFilter: undefined,
        value: 'XM0',
      },
    })
  })

  it('requests resale clients through the targeted clients endpoint', async () => {
    const client: Client = { NetUid: 'client-1', FullName: 'Ivanenko' }
    const params: ClientSearchParams = {
      active: true,
      forReSale: true,
      limit: 20,
      offset: 0,
      value: 'Ivanenko',
    }

    apiRequestMock.mockResolvedValueOnce([client])

    await expect(getClients(params)).resolves.toEqual([client])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        active: true,
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        forReSale: true,
        limit: 20,
        offset: 0,
        typeRoleFilter: undefined,
        value: 'Ivanenko',
      },
    })
  })

  it('keeps sorted client table loads on the targeted clients endpoint', async () => {
    const client: Client = { NetUid: 'client-1', FullName: 'Ivanenko' }
    const params: ClientSearchParams = {
      active: true,
      filterSql: 'RegionCode.Value/Client.FullName',
      forReSale: null,
      limit: 20,
      offset: 0,
      sortDescriptors: [{ Column: 'FullName', Dir: 'desc' }],
      value: 'Ivanenko',
    }

    apiRequestMock.mockResolvedValueOnce([client])

    await expect(getClients(params)).resolves.toEqual([client])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        active: true,
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: undefined,
        value: 'Ivanenko',
      },
    })
  })

  it('requests suppliers through the targeted suppliers endpoint', async () => {
    const supplier: Client = { NetUid: 'supplier-1', FullName: 'Provider' }
    const params: ClientSearchParams = {
      offset: 0,
      limit: 20,
      value: 'Provider',
      active: null,
      forReSale: null,
      filterSql: 'RegionCode.Value/Client.FullName',
      typeRoleFilter: '7',
      sortDescriptors: [{ Column: 'PurchaseVolumeEur', Dir: 'desc' }],
    }

    apiRequestMock.mockResolvedValueOnce([supplier])

    await expect(getSuppliers(params)).resolves.toEqual([supplier])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/registry/all/filtered', {
      query: {
        active: null,
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: '7',
        value: 'Provider',
      },
    })
  })

  it('requests the clients export document with the search filter query', async () => {
    const params: ClientSearchParams = {
      offset: 40,
      limit: 20,
      value: 'Kyiv',
      active: true,
      forReSale: true,
    }
    const document = { PdfDocumentURL: '/exports/clients.pdf' }

    apiRequestMock.mockResolvedValueOnce(document)

    await expect(exportClientsDocument(params)).resolves.toEqual(document)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/document', {
      query: {
        filter: buildClientsSearchFilter(params),
      },
    })
  })

  it('requests supplier export with the same filtered document contract as the table', async () => {
    const params: ClientSearchParams = {
      active: true,
      filterEntityType: 7,
      filterSql: 'Client.FullName',
      limit: 100,
      offset: 0,
      typeRoleFilter: '3',
      value: 'Provider',
    }
    const document = { DocumentURL: '/exports/suppliers.xlsx' }

    apiRequestMock.mockResolvedValueOnce(document)

    await expect(exportSuppliersDocument(params)).resolves.toEqual(document)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/document/export', {
      query: {
        filter: buildClientsSearchFilter(params),
      },
    })
  })

  it('requests the default buyer clients count and normalizes string totals', async () => {
    apiRequestMock.mockResolvedValueOnce('42')

    await expect(getClientCount()).resolves.toBe(42)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/total', {
      query: {
        type: 0,
      },
    })
  })

  it('loads dynamic client filter items through the source endpoint', async () => {
    const filterItems = [{ SQL: 'Client.FullName', Name: 'Повна назва' }]

    apiRequestMock.mockResolvedValueOnce(filterItems)

    await expect(getClientFilterItems()).resolves.toEqual(filterItems)
    expect(apiRequestMock).toHaveBeenCalledWith('/filteritems/all', {
      query: {
        type: 0,
      },
    })
  })

  it('loads one client identity attention marker', async () => {
    const attention = createIdentityAttention('client-1')
    apiRequestMock.mockResolvedValueOnce(attention)

    await expect(getClientIdentityAttention('client-1')).resolves.toEqual(attention)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/identity-attention', {
      query: { netId: 'client-1' },
    })
  })

  it('loads identity attention for a visible client page in one request', async () => {
    const attention = createIdentityAttention('client-1')
    apiRequestMock.mockResolvedValueOnce([attention])

    await expect(
      getClientIdentityAttentionBatch(['client-1', 'client-1']),
    ).resolves.toEqual([attention])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/identity-attention/batch', {
      method: 'POST',
      body: ['client-1'],
    })
  })

  it('loads 1C source-quality markers for a visible client page in one request', async () => {
    const quality = createSourceQuality('client-1')
    const controller = new AbortController()
    apiRequestMock.mockResolvedValueOnce([quality])

    await expect(
      getClientSourceQualityBatch(
        ['client-1', 'client-1'],
        controller.signal,
      ),
    ).resolves.toEqual([quality])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/source-quality/batch', {
      method: 'POST',
      body: ['client-1'],
      signal: controller.signal,
    })
  })

  it('drops malformed 1C source-quality markers', async () => {
    apiRequestMock.mockResolvedValueOnce([
      createSourceQuality('client-1'),
      { ClientNetUid: 'broken' },
      {
        ...createSourceQuality('inconsistent-clean-card'),
        State: 'clean',
        RequiresReview: false,
        SourceSnapshotCount: 0,
        SourceSystemCount: 0,
      },
    ])

    await expect(
      getClientSourceQualityBatch([
        'client-1',
        'broken',
        'inconsistent-clean-card',
      ]),
    ).resolves.toEqual([createSourceQuality('client-1')])
  })

  it('loads the non-destructive commercial structure for one selected card', async () => {
    const structure = createCommercialStructure('client-1')
    const controller = new AbortController()
    apiRequestMock.mockResolvedValueOnce(structure)

    await expect(
      getClientCommercialStructure('client-1', controller.signal),
    ).resolves.toEqual(structure)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/commercial-structure', {
      query: { netId: 'client-1' },
      signal: controller.signal,
    })
  })

  it('rejects a malformed commercial structure instead of rendering guessed data', async () => {
    apiRequestMock.mockResolvedValueOnce({ ClientNetUid: 'client-1' })

    await expect(getClientCommercialStructure('client-1')).resolves.toBeNull()
  })

  it('rejects malformed operational source evidence instead of crashing the structure view', async () => {
    const structure = createCommercialStructure('client-1')
    structure.LegalParties[0].Cards[0].SourceSnapshots[0].Contacts = 'not-an-array' as never
    apiRequestMock.mockResolvedValueOnce(structure)

    await expect(getClientCommercialStructure('client-1')).resolves.toBeNull()
  })

  it('validates exact source-folder evidence before rendering it', async () => {
    const malformedGroup = createCommercialStructure('client-1')
    malformedGroup.GroupCode = 35 as never
    apiRequestMock.mockResolvedValueOnce(malformedGroup)

    await expect(getClientCommercialStructure('client-1')).resolves.toBeNull()

    const malformedSnapshot = createCommercialStructure('client-1')
    malformedSnapshot.LegalParties[0].Cards[0]
      .SourceSnapshots[0].DirectClientGroupSourceCode = '4334' as never
    apiRequestMock.mockResolvedValueOnce(malformedSnapshot)

    await expect(getClientCommercialStructure('client-1')).resolves.toBeNull()
  })

  it('persists a client identity decision with a fresh idempotency key', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ClientNetUid: '11111111-1111-1111-1111-111111111111',
      GroupNetUid: '33333333-3333-3333-3333-333333333333',
      Revision: 2,
      Replayed: false,
    })

    await expect(mutateClientIdentity('confirm', {
      ClientNetUid: '11111111-1111-1111-1111-111111111111',
      RelatedClientNetUid: '22222222-2222-2222-2222-222222222222',
      RelationshipKind: 'related',
      ExpectedRevision: 1,
      Comment: 'Перевірено менеджером',
    })).resolves.toMatchObject({ Revision: 2, Replayed: false })

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/identity-links/confirm', {
      method: 'POST',
      body: expect.objectContaining({
        RelatedClientNetUid: '22222222-2222-2222-2222-222222222222',
      }),
      headers: {
        'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    })
  })

  it('loads dynamic supplier filter items through the source endpoint', async () => {
    const filterItems = [{ SQL: 'Client.FullName', Name: 'Постачальник' }]

    apiRequestMock.mockResolvedValueOnce({ Items: filterItems })

    await expect(getSupplierFilterItems()).resolves.toEqual(filterItems)
    expect(apiRequestMock).toHaveBeenCalledWith('/filteritems/all', {
      query: {
        type: 7,
      },
    })
  })

  it('requests the provider supplier count', async () => {
    apiRequestMock.mockResolvedValueOnce({ Count: '7' })

    await expect(getSupplierCount()).resolves.toBe(7)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/registry/total', {
      query: {
        type: 1,
      },
    })
  })

  it('passes the client net id when toggling active state', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await switchClientActiveState('client-net-id')

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/switch/active', {
      query: {
        netId: 'client-net-id',
      },
    })
  })

  it('uses the permission-scoped route when the clients registry toggles active state', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await switchClientActiveStateForRegistry('client-net-id')

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/registry/switch/active', {
      query: {
        netId: 'client-net-id',
      },
    })
  })

  it('posts order expiration updates with query params and an empty body', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await updateClientOrderExpireDays('client-net-id', 14)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update/order/expire', {
      method: 'POST',
      query: {
        clientNetId: 'client-net-id',
        days: 14,
      },
      body: {},
    })
  })
})

function createIdentityAttention(clientNetUid: string) {
  return {
    ClientNetUid: clientNetUid,
    AsOfUtc: '2026-08-02T10:00:00Z',
    AttentionLevel: 'warning',
    LegalCodeQuality: 'invalid',
    NormalizedLegalCode: null,
    RequiresReview: true,
    HasCreditRiskSignal: false,
    HasOverdueDebt: false,
    HasOwnOverdueDebt: false,
    HasRelatedOverdueDebt: false,
    IsTargetBlocked: false,
    HasRelatedBlockedCard: false,
    MaxOverdueDays: 0,
    OwnMaxOverdueDays: 0,
    RelatedMaxOverdueDays: 0,
    RelatedCardCount: 1,
    BuyerCardCount: 2,
    AttentionReasons: ['invalid_legal_code'],
    Candidates: [],
    OverdueByCurrency: [],
  }
}

function createCommercialStructure(clientNetUid: string) {
  return {
    ClientNetUid: clientNetUid,
    AsOfUtc: '2026-08-11T10:00:00Z',
    GroupKey: 'XM052',
    GroupCode: 'XM05200',
    GroupName: null,
    State: 'review_required',
    RequiresReview: true,
    IsPartial: false,
    CardCount: 1,
    AgreementCount: 1,
    ActiveAgreementCount: 1,
    SaleCount: 8,
    Reasons: ['region_code_family'],
    LegalParties: [{
      Key: 'legal:37263688',
      State: 'self',
      IsTarget: true,
      RequiresReview: false,
      AgreementCount: 1,
      ActiveAgreementCount: 1,
      SaleCount: 8,
      Reasons: ['same_legal_code'],
      Cards: [{
        ClientId: 1,
        ClientNetUid: clientNetUid,
        IsSubClient: false,
        IsTradePoint: false,
        IsActive: true,
        IsBlocked: false,
        IsTarget: true,
        HasExplicitRelationship: true,
        AgreementCount: 1,
        ActiveAgreementCount: 1,
        SaleCount: 8,
        Reasons: ['same_legal_code'],
        SourceSnapshots: [{
          SourceSystem: 'amg',
          SourceCode: 1545,
          DirectClientGroupSourceCode: 4334,
          DirectClientGroupRegionCode: 'BXM05200',
          DirectClientGroupSourceMarkedDeleted: false,
          BankName: 'АТ Тест Банк',
          ManagerName: 'Марія Іваненко',
          QuantityDayDebt: 14,
          IsControlDayDebt: true,
          Contacts: [{
            AddressType: 'Email',
            InfoType: 'Email',
            SourceAddressKindCode: 'EMAIL',
            Value: 'client@example.test',
            IsUnclassified: false,
          }],
          Agreements: [{
            SourceCode: 7001,
            Name: 'Основний договір',
            Number: 'A-7001',
            CurrencyCode: 'UAH',
            PermissibleDebtAmount: 50_000,
            DebtDaysAllowedNumber: 14,
            OrganizationName: 'ТОВ АМГ КОНКОРД',
            TypePriceName: 'ЦР',
            PromotionalTypePriceName: null,
            AgreementType: 'WithBuyer',
            FromDate: '2026-01-01T00:00:00Z',
            ToDate: null,
            IsManagementAccounting: true,
            IsAccounting: false,
            SourceMarkedDeleted: false,
          }],
          SourceMarkedDeleted: false,
          SourceIdentityValid: true,
          EvidenceTruncated: false,
          LastSeenAtUtc: '2026-08-13T12:56:15Z',
        }],
      }],
    }],
  }
}

function createSourceQuality(clientNetUid: string) {
  return {
    ClientNetUid: clientNetUid,
    AsOfUtc: '2026-08-11T10:00:00Z',
    State: 'review_required',
    RequiresReview: true,
    SourceSnapshotCount: 2,
    SourceSystemCount: 2,
    HasFenixSnapshot: true,
    HasAmgSnapshot: true,
    LastSeenAtUtc: '2026-08-11T09:55:00Z',
    Reasons: ['conflicting_region_code_family'],
  }
}

describe('clients permission-scoped registry and structure contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses only scoped read routes for registry diagnostics and structure', async () => {
    const params: ClientSearchParams = { limit: 25, offset: 0, value: 'Магром' }
    const attention = createIdentityAttention('client-1')
    const quality = createSourceQuality('client-1')
    const structure = createCommercialStructure('client-1')
    const document = { PdfDocumentURL: '/exports/clients.pdf' }

    apiRequestMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([attention])
      .mockResolvedValueOnce([quality])
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(document)

    await getClientsForStructure(params)
    await getClientIdentityAttentionBatchForRegistry(['client-1'])
    await getClientSourceQualityBatchForRegistry(['client-1'])
    await getClientCommercialStructureForRegistry('client-1')
    await exportClientsDocumentForRegistry(params)

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/clients/structure/registry', {
      query: {
        active: undefined,
        filterSql: 'RegionCode.Value/Client.FullName/Client.USREOU',
        limit: 25,
        offset: 0,
        typeRoleFilter: undefined,
        value: 'Магром',
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/clients/registry/identity-attention/batch', {
      method: 'POST',
      body: ['client-1'],
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/clients/registry/source-quality/batch', {
      method: 'POST',
      body: ['client-1'],
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/clients/structure/details', {
      query: { netId: 'client-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(5, '/clients/registry/document/export', {
      query: { filter: buildClientsSearchFilter(params) },
    })
  })

  it('uses separate permission-scoped mutation routes', async () => {
    apiRequestMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ClientNetUid: '11111111-1111-1111-1111-111111111111',
        Revision: 3,
      })

    await updateClientOrderExpireDaysForRegistry('client-1', 14)
    await mutateClientIdentityForStructure('confirm', {
      ClientNetUid: '11111111-1111-1111-1111-111111111111',
      RelatedClientNetUid: '22222222-2222-2222-2222-222222222222',
      RelationshipKind: 'related',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/clients/registry/reservation-days', {
      method: 'POST',
      query: { clientNetId: 'client-1', days: 14 },
      body: {},
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/clients/structure/identity-links/confirm', {
      method: 'POST',
      body: {
        ClientNetUid: '11111111-1111-1111-1111-111111111111',
        RelatedClientNetUid: '22222222-2222-2222-2222-222222222222',
        RelationshipKind: 'related',
      },
      headers: { 'Idempotency-Key': expect.any(String) },
    })
  })
})
