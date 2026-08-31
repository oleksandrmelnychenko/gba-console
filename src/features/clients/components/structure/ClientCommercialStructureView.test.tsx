import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../../shared/theme/theme'
import { mutateClientIdentity } from '../../api/clientsApi'
import type { ClientCommercialStructure } from '../../types'
import { ClientCommercialStructureView } from './ClientCommercialStructureView'

vi.mock('../../api/clientsApi', () => ({
  mutateClientIdentity: vi.fn(),
}))

const mutateClientIdentityMock = vi.mocked(mutateClientIdentity)

const t = (value: string) => value

describe('ClientCommercialStructureView', () => {
  it('shows the business hierarchy first and keeps raw 1C evidence collapsed', () => {
    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={createStructure()} t={t} />
      </MantineProvider>,
    )

    expect(screen.getByText('Комерційна група · ХМ052')).toBeTruthy()
    expect(screen.getByText('Є дані, які треба перевірити')).toBeTruthy()
    expect(screen.getByText(/Однозначні картки об’єднуються автоматично зі збереженням договорів/)).toBeTruthy()
    expect(screen.getByText(/Сумнівні зв’язки не об’єднуються й залишаються на перевірку/)).toBeTruthy()
    expect(screen.getByText('Структура клієнта')).toBeTruthy()
    expect(screen.getAllByText('ТОВ МАГРОМ').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Покупець')).toBeTruthy()
    expect(screen.queryByText('Buyer')).toBeNull()
    const regionCodeValues = screen.getAllByText('BXM05202')
    expect(regionCodeValues.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('код 01234567')).toBeTruthy()
    expect(regionCodeValues.some((value) => Boolean(value.closest('.client-card-code-chip')))).toBe(true)
    expect(screen.getAllByText('AMG').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Марія Іваненко')).toBeTruthy()
    expect(screen.getByText('UA123456789 · UAH')).toBeTruthy()
    expect(screen.getByText('client@example.test')).toBeTruthy()
    expect(screen.getByText('Договори та кредитні умови 1С · 1')).toBeTruthy()
    expect(screen.getByText('50 000 UAH')).toBeTruthy()
    expect(screen.getByText('Пошкоджений ідентифікатор джерела — потрібна перевірка')).toBeTruthy()
    expect(screen.getByText('Картку позначено видаленою у 1С — не використовуйте без перевірки')).toBeTruthy()
    expect(screen.getByText('Пошкоджене або надмірно довге значення з 1С нормалізовано — перевірте оригінал')).toBeTruthy()

    const selectedParty = container.querySelector<HTMLDetailsElement>('.client-legal-party')
    const technicalAudit = screen.getByText('Деталі перевірки 1С').closest('details')
    expect(selectedParty?.open).toBe(true)
    expect(technicalAudit?.open).toBe(false)
  })

  it('makes a truncated candidate set impossible to mistake for a complete group', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView
          structure={{ ...createStructure(), IsPartial: true }}
          t={t}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Показано не всю групу')).toBeTruthy()
  })

  it('shows the canonical family code with the 1C group name and every card agreement', () => {
    const structure = {
      ...createStructure(),
      GroupName: 'Хмельницький - Назаришин В. М.',
    }
    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    expect(screen.getByText('ХМ052 · Хмельницький - Назаришин В. М.')).toBeTruthy()
    const targetCard = container.querySelector<HTMLElement>('[data-client-id="10"] .client-source-card')
    expect(targetCard).not.toBeNull()
    expect(within(targetCard!).getByText('Дані 1С · 2')).toBeTruthy()
    expect(targetCard!.querySelector('[data-source-system="fenix"]')).not.toBeNull()
    const deletedAmg = targetCard!.querySelector<HTMLElement>('[data-source-system="amg"]')
    expect(deletedAmg).not.toBeNull()
    expect(deletedAmg!.classList.contains('is-deleted')).toBe(true)
    expect(within(deletedAmg!).getByText('видалений у 1С')).toBeTruthy()
    expect(within(targetCard!).getByText('Договори 1С · 1')).toBeTruthy()
    expect(within(targetCard!).getByText('Основний договір · A-7001')).toBeTruthy()
    expect(within(targetCard!).getByText('чинний на дату зрізу')).toBeTruthy()
  })

  it('prefers an exact source-folder code for the VI035 group title', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView
          structure={{
            ...createStructure(),
            GroupKey: 'VI035',
            GroupCode: 'VI03500',
            GroupName: 'Гайсин - Решетнік Ігор Володимирович',
          }}
          t={t}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('VI03500 · Гайсин - Решетнік Ігор Володимирович')).toBeTruthy()
  })

  it('keeps the visible GBA root name when a merged source alias sorts first', () => {
    const structure = createStructure()
    structure.GroupKey = 'VI035'
    structure.GroupCode = 'VI03500'
    structure.GroupName = 'Гайсин - Решетнік Ігор Володимирович'
    const root = structure.LegalParties[0].Cards[0]
    root.DisplayName = 'РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП'
    root.SourceSnapshots[0] = {
      ...root.SourceSnapshots[0],
      SourceCode: 2577,
      ClientName: 'Гайсин - Решетнік Ігор Володимирович готівка',
      FullName: 'Гайсин - Решетнік Ігор Володимирович готівка',
    }

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    const rootCard = container.querySelector<HTMLElement>('[data-client-id="10"] .client-source-card')
    expect(rootCard).not.toBeNull()
    expect(within(rootCard!).getByText('РЕШЕТНІК ІГОР ВОЛОДИМИРОВИЧ ФОП')).toBeTruthy()
    expect(within(rootCard!).getByText('Гайсин - Решетнік Ігор Володимирович готівка')).toBeTruthy()
  })

  it('keeps the established XM052 business title when exact folder evidence is present', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView
          structure={{
            ...createStructure(),
            GroupCode: 'XM05200',
            GroupName: 'Хмельницький - Назаришин В. М.',
          }}
          t={t}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('ХМ052 · Хмельницький - Назаришин В. М.')).toBeTruthy()
  })

  it('derives agreement activity from the structure snapshot date', () => {
    const structure = createStructure()
    structure.AsOfUtc = '2026-08-11T23:59:59'
    const target = structure.LegalParties[0].Cards[0]
    const fenix = target.SourceSnapshots.find((snapshot) => snapshot.SourceSystem === 'fenix')!
    const agreement = fenix.Agreements[0]
    fenix.Agreements = [
      agreement,
      {
        ...agreement,
        SourceCode: 7002,
        Name: 'Минулий договір',
        Number: 'A-7002',
        FromDate: '2025-01-01T00:00:00Z',
        ToDate: '2026-08-10T23:59:59',
      },
      {
        ...agreement,
        SourceCode: 7003,
        Name: 'Майбутній договір',
        Number: 'A-7003',
        FromDate: '2026-08-12T00:00:00',
        ToDate: null,
      },
      {
        ...agreement,
        SourceCode: 7004,
        Name: 'Без строку',
        Number: 'A-7004',
        FromDate: null,
        ToDate: null,
      },
    ]

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    const fenixNode = container.querySelector<HTMLElement>('[data-source-system="fenix"]')
    expect(fenixNode).not.toBeNull()
    expect(within(fenixNode!).getByText('чинний на дату зрізу')).toBeTruthy()
    expect(within(fenixNode!).getByText('строк дії минув')).toBeTruthy()
    expect(within(fenixNode!).getByText('ще не діє на дату зрізу')).toBeTruthy()
    expect(within(fenixNode!).getByText('не видалений у 1С')).toBeTruthy()
  })

  it('renders every exact XM052 source card with its own 1C agreements', () => {
    const structure = createStructure()
    structure.GroupName = 'Хмельницький - Назаришин В. М.'
    const template = structure.LegalParties[0].Cards[0]
    const sourceTemplate = template.SourceSnapshots.find((snapshot) => !snapshot.SourceMarkedDeleted)!
    const agreementTemplate = sourceTemplate.Agreements[0]
    const sourceCards = [
      ['XM05201', 'Хмельницький - ФОП Назаришин Валерій Миколайович'],
      ['BXM05202', 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "МАГРОМ"'],
      ['BXM05203', 'ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ НАЗАРИШИН ВАЛЕРІЙ МИКОЛАЙОВИЧ'],
      ['XM05204', 'Камянець Подільський  - ФОП Назаришин Валерій Миколайович'],
      ['BXM05205', 'Фізична особа-підприємець ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ'],
      ['BXM05206', 'ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ МАМИЧ ДІАНА ОЛЕКСАНДРІВНА'],
    ] as const

    structure.LegalParties[0].Cards = sourceCards.map(([regionCode, sourceName], index) => ({
      ...template,
      ClientId: 100 + index,
      ClientNetUid: `00000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
      DisplayName: `GBA card ${index + 1}`,
      CurrentRegionCode: regionCode,
      OriginalRegionCode: regionCode,
      MainClientId: index >= 2 && index !== 3 ? 101 : null,
      IsTarget: index === 1,
      SourceSnapshots: [{
        ...sourceTemplate,
        SourceCode: 3900 + index,
        ClientName: `Клієнт 1С ${index + 1}`,
        FullName: sourceName,
        RegionCode: regionCode,
        Agreements: [{
          ...agreementTemplate,
          SourceCode: 5100 + index,
          Name: `Договір ${regionCode}`,
          Number: `K-${index + 1}`,
        }],
      }],
    }))

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    expect(screen.getByText('ХМ052 · Хмельницький - Назаришин В. М.')).toBeTruthy()
    sourceCards.forEach(([regionCode, sourceName], index) => {
      const sourceNode = container.querySelector<HTMLElement>(`[data-source-code="${3900 + index}"]`)
      expect(sourceNode).not.toBeNull()
      expect(sourceNode!.querySelector('.client-source-card__source-name')?.textContent).toBe(sourceName)
      expect(within(sourceNode!).getByText(`Договір ${regionCode} · K-${index + 1}`)).toBeTruthy()
    })
  })

  it('renders the synchronized client hierarchy at arbitrary depth', () => {
    const structure = createStructure()
    structure.LegalParties[0].Cards.push(
      {
        ...structure.LegalParties[0].Cards[0],
        ClientId: 11,
        ClientNetUid: '22222222-2222-2222-2222-222222222222',
        DisplayName: 'ТОВ МАГРОМ · філія',
        MainClientId: 10,
        IsSubClient: true,
        IsTarget: false,
        SourceSnapshots: [],
      },
      {
        ...structure.LegalParties[0].Cards[0],
        ClientId: 12,
        ClientNetUid: '33333333-3333-3333-3333-333333333333',
        DisplayName: 'ТОВ МАГРОМ · торгова точка',
        MainClientId: 11,
        IsSubClient: false,
        IsTradePoint: true,
        IsTarget: false,
        SourceSnapshots: [],
      },
    )

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    expect(container.querySelector('[data-client-id="10"]')?.getAttribute('data-client-depth')).toBe('0')
    expect(container.querySelector('[data-client-id="11"]')?.getAttribute('data-client-depth')).toBe('1')
    expect(container.querySelector('[data-client-id="12"]')?.getAttribute('data-client-depth')).toBe('2')
    expect(screen.getByText(/Головний клієнт: ТОВ МАГРОМ · філія/)).toBeTruthy()
  })

  it('renders source parent edges even when cards belong to different legal parties', () => {
    const structure = createStructure()
    structure.LegalParties.push({
      Key: 'legal:3267717855',
      DisplayName: 'ФОП ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ',
      NormalizedLegalCode: '3267717855',
      State: 'confirmed',
      IsTarget: false,
      RequiresReview: false,
      AgreementCount: 1,
      ActiveAgreementCount: 1,
      SaleCount: 247,
      Reasons: ['explicit_hierarchy'],
      Cards: [{
        ...structure.LegalParties[0].Cards[0],
        ClientId: 20,
        ClientNetUid: '44444444-4444-4444-4444-444444444444',
        DisplayName: 'ФОП ДОМАТЕВИЧ СЕРГІЙ ОЛЕКСАНДРОВИЧ',
        MainClientId: 10,
        IsTarget: false,
        IsTradePoint: true,
        SourceSnapshots: [],
      }],
    })

    const { container } = render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView structure={structure} t={t} />
      </MantineProvider>,
    )

    expect(container.querySelector('[data-legal-party-key="legal:01234567"]')?.getAttribute('data-legal-party-depth')).toBe('0')
    expect(container.querySelector('[data-legal-party-key="legal:3267717855"]')?.getAttribute('data-legal-party-depth')).toBe('1')
    expect(screen.getByText(/Головний клієнт: ТОВ МАГРОМ/)).toBeTruthy()
  })

  it('keeps pre-migration source evidence visible but disables identity decisions', () => {
    render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView
          structure={{
            ...createStructure(),
            IdentityMutationsEnabled: false,
            Reasons: [
              ...createStructure().Reasons,
              'identity_resolution_unavailable',
            ],
          }}
          t={t}
          onChanged={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Рішення щодо зв’язків тимчасово недоступні')).toBeTruthy()
    expect(screen.getByText(/Структуру побудовано з наявних даних 1С/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Дії зі зв’язком' })).toBeNull()
    expect(screen.getAllByText('BXM05202').length).toBeGreaterThanOrEqual(2)
  })

  it('lets an operator confirm a candidate without moving financial ownership', async () => {
    mutateClientIdentityMock.mockResolvedValueOnce({
      ClientNetUid: '11111111-1111-1111-1111-111111111111',
      GroupNetUid: '33333333-3333-3333-3333-333333333333',
      Revision: 1,
      Replayed: false,
    })
    const structure = createStructure()
    const candidate = {
      ...structure.LegalParties[0].Cards[0],
      ClientId: 11,
      ClientNetUid: '22222222-2222-2222-2222-222222222222',
      DisplayName: 'ТОВ МАГРОМ ФІЛІЯ',
      IsTarget: false,
      SourceSnapshots: [],
    }
    structure.LegalParties[0].Cards.push(candidate)
    const onChanged = vi.fn()

    render(
      <MantineProvider env="test" theme={theme}>
        <ClientCommercialStructureView
          canManageIdentity
          structure={structure}
          t={t}
          onChanged={onChanged}
        />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Дії зі зв’язком' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Підтвердити зв’язок' }))
    expect(await screen.findByText(/Договори, продажі, платежі та баланси залишаться/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Коментар до рішення'), {
      target: { value: 'Перевірено оператором' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    await waitFor(() => expect(mutateClientIdentityMock).toHaveBeenCalledWith('confirm', {
      ClientNetUid: '11111111-1111-1111-1111-111111111111',
      RelatedClientNetUid: '22222222-2222-2222-2222-222222222222',
      RelationshipKind: 'related',
      ExpectedRevision: undefined,
      Comment: 'Перевірено оператором',
    }))
    expect(onChanged).toHaveBeenCalledOnce()
  })
})

function createStructure(): ClientCommercialStructure {
  return {
    ClientNetUid: '11111111-1111-1111-1111-111111111111',
    AsOfUtc: '2026-08-11T12:00:00Z',
    GroupKey: 'XM052',
    GroupName: null,
    IdentityMutationsEnabled: true,
    State: 'review_required',
    RequiresReview: true,
    IsPartial: false,
    CardCount: 1,
    AgreementCount: 2,
    ActiveAgreementCount: 1,
    SaleCount: 7,
    Reasons: ['region_code_family', 'invalid_source_identity'],
    LegalParties: [{
      Key: 'legal:01234567',
      DisplayName: 'ТОВ МАГРОМ',
      NormalizedLegalCode: '01234567',
      State: 'self',
      IsTarget: true,
      RequiresReview: false,
      AgreementCount: 2,
      ActiveAgreementCount: 1,
      SaleCount: 7,
      Reasons: ['same_legal_code'],
      Cards: [{
        ClientId: 10,
        ClientNetUid: '11111111-1111-1111-1111-111111111111',
        DisplayName: 'ТОВ МАГРОМ',
        CurrentRegionCode: 'BXM05202',
        OriginalRegionCode: 'BXM05202',
        Usreou: '01234567',
        Tin: null,
        RoleType: 0,
        RoleName: 'Buyer',
        MainClientId: null,
        IsSubClient: false,
        IsTradePoint: false,
        IsActive: true,
        IsBlocked: false,
        IsTarget: true,
        HasExplicitRelationship: false,
        AgreementCount: 2,
        ActiveAgreementCount: 1,
        SaleCount: 7,
        Reasons: ['invalid_source_identity'],
        SourceSnapshots: [{
          SourceSystem: 'fenix',
          SourceCode: 3929,
          ClientName: 'МАГРОМ ТОВ',
          FullName: 'ТОВ МАГРОМ',
          Tin: null,
          Usreou: '01234567',
          RegionCode: 'BXM05202',
          RegionName: 'Хмельницький',
          MainClientCode: 3929,
          MainClientName: 'МАГРОМ ТОВ',
          DirectClientGroupName: 'Хмельницький - Назаришин В. М.',
          ClientGroupName: 'Покупці',
          BankName: 'АТ Тест Банк',
          BankAccountNumber: 'UA123456789',
          BankCurrencyCode: 'UAH',
          MainContactPersonName: 'Олег Керівник',
          MainContactPersonPosition: 'Директор',
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
            PermissibleDebtAmount: 50000,
            DebtDaysAllowedNumber: 14,
            OrganizationName: 'ТОВ «АМГ «КОНКОРД»',
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
          LastSeenAtUtc: '2026-08-11T11:00:00Z',
        }, {
          SourceSystem: 'amg',
          SourceCode: 1545,
          ClientName: 'МАГРОМ ТОВ',
          FullName: 'ТОВ МАГРОМ · видалена картка',
          Tin: null,
          Usreou: '01234567',
          RegionCode: 'BXM05202',
          RegionName: 'Хмельницький',
          MainClientCode: 1545,
          MainClientName: 'МАГРОМ ТОВ',
          DirectClientGroupName: 'Хмельницький - Назаришин',
          ClientGroupName: 'Покупці',
          BankName: null,
          BankAccountNumber: null,
          BankCurrencyCode: null,
          MainContactPersonName: null,
          MainContactPersonPosition: null,
          ManagerName: null,
          QuantityDayDebt: null,
          IsControlDayDebt: null,
          Contacts: [],
          Agreements: [],
          SourceMarkedDeleted: true,
          SourceIdentityValid: false,
          EvidenceTruncated: true,
          LastSeenAtUtc: '2026-08-11T10:00:00Z',
        }],
      }],
    }],
  }
}
