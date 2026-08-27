import { describe, expect, it } from 'vitest'
import type {
  Client,
  ClientCommercialCard,
  ClientCommercialStructure,
  ClientSourceCardSnapshot,
} from './types'
import { buildClientFolderTree } from './clientFolderTree'

const ROOT_NET_UID = '11111111-1111-4111-8111-111111111111'
const CHILD_NET_UID = '22222222-2222-4222-8222-222222222222'

describe('buildClientFolderTree', () => {
  it('projects the exact ...00 folder and keeps individual cards on their stable NetUid', () => {
    const rootClient: Client = {
      Id: 10,
      NetUid: ROOT_NET_UID,
      FullName: 'ФОП Назаришин Валерій Миколайович',
      RegionCode: { Value: 'XM05201' },
    }
    const rootCard = makeCard({
      ClientId: 10,
      ClientNetUid: ROOT_NET_UID,
      CurrentRegionCode: 'XM05201',
      DisplayName: 'ФОП Назаришин Валерій Миколайович',
      IsTarget: true,
    })
    const childCard = makeCard({
      ClientId: 11,
      ClientNetUid: CHILD_NET_UID,
      CurrentRegionCode: 'XM05202',
      DisplayName: 'МАГРОМ ТОВ',
      IsTradePoint: true,
      MainClientId: 10,
    })
    const grandchildCard = makeCard({
      ClientId: 12,
      ClientNetUid: '33333333-3333-4333-8333-333333333333',
      CurrentRegionCode: 'XM05203',
      DisplayName: 'НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ ФОП',
      IsTradePoint: true,
      MainClientId: 11,
    })
    const unprovenFamilyCandidate = makeCard({
      ClientId: 99,
      ClientNetUid: '99999999-9999-4999-8999-999999999999',
      CurrentRegionCode: 'XM05299',
      DisplayName: 'Схожий код без підтвердженого зв’язку',
      HasExplicitRelationship: false,
    })

    const tree = buildClientFolderTree(
      rootClient,
      makeStructure(
        [rootCard, childCard, grandchildCard, unprovenFamilyCandidate],
        {
          GroupCode: 'XM05200',
          GroupName: 'Хмельницький - Назаришин В. М.',
        },
      ),
    )

    expect(tree).toEqual(expect.objectContaining({
      code: 'XM05200',
      name: 'Хмельницький - Назаришин В. М.',
      rootClientNetUid: ROOT_NET_UID,
    }))
    expect(tree?.items.map((item) => [item.code, item.clientNetUid, item.requiresReview])).toEqual([
      ['XM05201', ROOT_NET_UID, false],
      ['XM05202', CHILD_NET_UID, false],
      ['XM05203', '33333333-3333-4333-8333-333333333333', false],
      ['XM05299', '99999999-9999-4999-8999-999999999999', true],
    ])
  })

  it('renders the complete root tree when the same structure is opened through a child card', () => {
    const rootCard = makeCard({
      ClientId: 10,
      ClientNetUid: ROOT_NET_UID,
      CurrentRegionCode: 'XM05201',
    })
    const childCard = makeCard({
      ClientId: 11,
      ClientNetUid: CHILD_NET_UID,
      CurrentRegionCode: 'XM05202',
      IsTarget: true,
      IsTradePoint: true,
      MainClientId: 10,
    })

    const tree = buildClientFolderTree(
      {
        Id: 11,
        NetUid: CHILD_NET_UID,
        FullName: 'МАГРОМ ТОВ',
        RegionCode: { Value: 'XM05202' },
      },
      makeStructure([rootCard, childCard], {
        ClientNetUid: CHILD_NET_UID,
        GroupCode: 'XM05200',
      }),
    )

    expect(tree).toEqual(expect.objectContaining({
      code: 'XM05200',
      rootClientNetUid: ROOT_NET_UID,
    }))
    expect(tree?.items.map((item) => [item.code, item.clientNetUid])).toEqual([
      ['XM05201', ROOT_NET_UID],
      ['XM05202', CHILD_NET_UID],
    ])
  })

  it('keeps a coincidental ...00 client on the standard form without parent evidence', () => {
    const client: Client = {
      Id: 20,
      NetUid: ROOT_NET_UID,
      FullName: 'Звичайний клієнт',
      RegionCode: { Value: 'XM99900' },
    }

    expect(buildClientFolderTree(
      client,
      makeStructure([makeCard({
        ClientId: 20,
        ClientNetUid: ROOT_NET_UID,
        CurrentRegionCode: 'XM99900',
        DisplayName: 'Звичайний клієнт',
        IsTarget: true,
      })]),
    )).toBeNull()
  })

  it('projects the complete six-card live XM tree from source folder codes', () => {
    const rootClient: Client = {
      Id: 30,
      NetUid: ROOT_NET_UID,
      FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "МАГРОМ"',
      RegionCode: { Value: 'XM05200' },
    }
    const cards = [
      makeCard({
        ClientId: 30,
        ClientNetUid: ROOT_NET_UID,
        CurrentRegionCode: 'XM05200',
        OriginalRegionCode: 'BXM05202',
        DisplayName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "МАГРОМ"',
        IsTarget: true,
        SourceSnapshots: [makeSnapshot('BXM05202', 'МАГРОМ ТОВ')],
      }),
      makeCard({
        ClientId: 31,
        ClientNetUid: '11111111-1111-4111-8111-111111111112',
        CurrentRegionCode: 'XM05201',
        DisplayName: 'Хмельницький - ФОП Назаришин Валерій Миколайович',
        HasExplicitRelationship: false,
        SourceSnapshots: [makeSnapshot('XM05201', 'ФОП Назаришин Валерій Миколайович')],
      }),
      makeCard({
        ClientId: 32,
        ClientNetUid: '11111111-1111-4111-8111-111111111113',
        CurrentRegionCode: 'XM05201',
        OriginalRegionCode: 'BXM05203',
        MainClientId: 30,
        SourceSnapshots: [makeSnapshot('BXM05203', 'НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ ФОП')],
      }),
      makeCard({
        ClientId: 33,
        ClientNetUid: '11111111-1111-4111-8111-111111111114',
        CurrentRegionCode: 'XM05204',
        HasExplicitRelationship: false,
        SourceSnapshots: [makeSnapshot('XM05204', "Кам'янець Подільський - ФОП Назаришин")],
      }),
      makeCard({
        ClientId: 34,
        ClientNetUid: '11111111-1111-4111-8111-111111111115',
        CurrentRegionCode: 'XM05202',
        OriginalRegionCode: 'BXM05205',
        MainClientId: 30,
        SourceSnapshots: [makeSnapshot('BXM05205', 'ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ ФОП')],
      }),
      makeCard({
        ClientId: 35,
        ClientNetUid: '11111111-1111-4111-8111-111111111116',
        CurrentRegionCode: 'XM05203',
        OriginalRegionCode: 'BXM05206',
        MainClientId: 30,
        SourceSnapshots: [makeSnapshot('BXM05206', 'МАМИЧ ДІАНА ОЛЕКСАНДРІВНА ФОП')],
      }),
    ]

    const tree = buildClientFolderTree(rootClient, makeStructure(cards, {
      GroupCode: null,
      GroupName: 'Хмельницький - Назаришин В. М.',
      RequiresReview: true,
    }))

    expect(tree?.items.map((item) => [item.code, item.name])).toEqual([
      ['XM05201', 'ФОП Назаришин Валерій Миколайович'],
      ['XM05202', 'МАГРОМ ТОВ'],
      ['XM05203', 'НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ ФОП'],
      ['XM05204', "Кам'янець Подільський - ФОП Назаришин"],
      ['XM05205', 'ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ ФОП'],
      ['XM05206', 'МАМИЧ ДІАНА ОЛЕКСАНДРІВНА ФОП'],
    ])
    expect(tree?.items.filter((item) => item.requiresReview).map((item) => item.code)).toEqual([
      'XM05201',
      'XM05204',
    ])
  })

  it('keeps the canonical VI03501 representative after BVI03502 consolidation', () => {
    const rootClient: Client = {
      Id: 40,
      NetUid: ROOT_NET_UID,
      FullName: 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП',
      RegionCode: { Value: 'VI03501' },
    }
    const tree = buildClientFolderTree(rootClient, makeStructure([
      makeCard({
        ClientId: 40,
        ClientNetUid: ROOT_NET_UID,
        CurrentRegionCode: 'VI03501',
        OriginalRegionCode: 'BVI03502',
        IsTarget: true,
        SourceSnapshots: [
          makeSnapshot('BVI03502', 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП'),
          makeSnapshot('VI03501', 'Гайсин - Решетнік Ігор Володимирович'),
        ],
      }),
      makeCard({
        ClientId: 41,
        ClientNetUid: CHILD_NET_UID,
        CurrentRegionCode: 'VI03503',
        OriginalRegionCode: 'BVI03503',
        MainClientId: 40,
        SourceSnapshots: [makeSnapshot('BVI03503', 'РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП')],
      }),
    ], {
      GroupCode: 'VI03500',
      GroupKey: 'VI035',
      GroupName: 'Гайсин - Решетнік Ігор Володимирович',
    }))

    expect(tree?.items.map((item) => [item.code, item.name])).toEqual([
      ['VI03501', 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП'],
      ['VI03503', 'РЕШЕТНІК ВАДИМ ІГОРОВИЧ ФОП'],
    ])
  })
})

function makeSnapshot(
  regionCode: string,
  clientName: string,
): ClientSourceCardSnapshot {
  return {
    Agreements: [],
    ClientName: clientName,
    Contacts: [],
    EvidenceTruncated: false,
    LastSeenAtUtc: '2026-08-19T12:00:00Z',
    RegionCode: regionCode,
    SourceCode: 1,
    SourceIdentityValid: true,
    SourceMarkedDeleted: false,
    SourceSystem: 'fenix',
  }
}

function makeCard(overrides: Partial<ClientCommercialCard>): ClientCommercialCard {
  return {
    ActiveAgreementCount: 0,
    AgreementCount: 0,
    ClientId: 1,
    ClientNetUid: ROOT_NET_UID,
    DisplayName: 'Клієнт',
    HasExplicitRelationship: true,
    IsActive: true,
    IsBlocked: false,
    IsSubClient: false,
    IsTarget: false,
    IsTradePoint: false,
    MainClientId: null,
    Reasons: [],
    SaleCount: 0,
    SourceSnapshots: [],
    ...overrides,
  }
}

function makeStructure(
  cards: ClientCommercialCard[],
  overrides: Partial<ClientCommercialStructure> = {},
): ClientCommercialStructure {
  return {
    ActiveAgreementCount: 0,
    AgreementCount: 0,
    AsOfUtc: '2026-08-19T12:00:00Z',
    CardCount: cards.length,
    ClientNetUid: ROOT_NET_UID,
    GroupKey: 'XM052',
    IsPartial: false,
    LegalParties: [{
      ActiveAgreementCount: 0,
      AgreementCount: 0,
      Cards: cards,
      DisplayName: 'Клієнти XM052',
      IsTarget: true,
      Key: 'party:root',
      Reasons: [],
      RequiresReview: false,
      SaleCount: 0,
      State: 'confirmed',
    }],
    Reasons: [],
    RequiresReview: false,
    SaleCount: 0,
    State: 'confirmed',
    ...overrides,
  }
}
