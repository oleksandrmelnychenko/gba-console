import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { Client, ClientCommercialCard, ClientCommercialStructure } from '../types'
import { ClientEditPage } from './ClientEditPage'

const ROOT_NET_UID = '11111111-1111-4111-8111-111111111111'
const CHILD_NET_UID = '22222222-2222-4222-8222-222222222222'
const ORDINARY_NET_UID = '33333333-3333-4333-8333-333333333333'

const apiMocks = vi.hoisted(() => ({
  deleteClient: vi.fn(),
  getClientById: vi.fn(),
  getClientCommercialStructure: vi.fn(),
  getClientIdentityAttention: vi.fn(),
  updateClient: vi.fn(),
  uploadClientContract: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/clientFormApi', () => ({
  deleteClient: apiMocks.deleteClient,
  getClientById: apiMocks.getClientById,
  updateClient: apiMocks.updateClient,
}))

vi.mock('../api/clientsApi', () => ({
  getClientCommercialStructure: apiMocks.getClientCommercialStructure,
  getClientIdentityAttention: apiMocks.getClientIdentityAttention,
}))

vi.mock('../api/clientCabinetApi', () => ({
  uploadClientContract: apiMocks.uploadClientContract,
}))

vi.mock('../hooks/useClientFormLookups', () => ({
  useClientFormLookups: () => ({
    error: null,
    isLoading: false,
    lookups: {
      countries: [],
      currencies: [],
      incoterms: [],
      packingMarkingPayments: [],
      packingMarkings: [],
      regions: [],
    },
    reloadCountries: vi.fn(),
    reloadIncoterms: vi.fn(),
    reloadRegions: vi.fn(),
  }),
}))

vi.mock('../components/form/validateClientForm', () => ({
  validateClientForm: () => ({}),
}))

vi.mock('../components/form/GeneralInfoFields', () => ({
  GeneralInfoFields: ({ client }: { client: Client }) => (
    <div>general:{client.NetUid}</div>
  ),
}))

vi.mock('../components/form/ContactInfoFields', () => ({
  ContactInfoFields: ({ client }: { client: Client }) => (
    <div>contacts:{client.NetUid}</div>
  ),
}))

vi.mock('../components/form/BankDetailsFields', () => ({
  BankDetailsFields: ({ client }: { client: Client }) => (
    <div>bank:{client.NetUid}</div>
  ),
}))

vi.mock('../components/pricing/PricingPanel', () => ({
  PricingPanel: ({ client, section }: { client: Client; section?: string }) => (
    <div>{section || 'pricing'}:{client.NetUid}</div>
  ),
}))

vi.mock('../components/perfect-client/PerfectClientPanel', () => ({
  PerfectClientPanel: ({ client }: { client: Client }) => (
    <div>perfect:{client.NetUid}</div>
  ),
}))

vi.mock('../components/structure/ClientStructurePanel', () => ({
  ClientStructurePanel: ({ client }: { client: Client }) => (
    <div>structure:{client.NetUid}</div>
  ),
}))

vi.mock('../components/structure/SubClientsPanel', () => ({
  SubClientsPanel: ({
    client,
    relationKind,
  }: {
    client: Client
    relationKind: string
  }) => <div>relationship:{relationKind}:{client.NetUid}</div>,
}))

vi.mock('../components/ecommerce/EcommercePanel', () => ({
  EcommercePanel: ({ client }: { client: Client }) => (
    <div>ecommerce:{client.NetUid}</div>
  ),
}))

vi.mock('../components/sales/SalesPanel', () => ({
  SalesPanel: ({ netId }: { netId: string }) => <div>sales:{netId}</div>,
}))

vi.mock('../components/recommendations/RecommendationsPanel', () => ({
  RecommendationsPanel: ({ client }: { client: Client }) => (
    <div>recommendations:{client.NetUid}</div>
  ),
}))

vi.mock('../components/solvency/SolvencyPanel', () => ({
  SolvencyPanel: ({ clientNetId }: { clientNetId?: string }) => (
    <div>solvency:{clientNetId}</div>
  ),
}))

vi.mock('../components/EditClientTypePanel', () => ({
  EditClientTypePanel: () => null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened, title }: {
    children: ReactNode
    footer?: ReactNode
    opened: boolean
    title?: ReactNode
  }) => opened ? (
    <section>
      <header>{title}</header>
      {children}
      <footer>{footer}</footer>
    </section>
  ) : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => (
    opened ? <section>{children}</section> : null
  ),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

describe('ClientEditPage root folder form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getClientIdentityAttention.mockResolvedValue(null)
    apiMocks.getClientById.mockImplementation(async (netUid: string) => {
      if (netUid === ROOT_NET_UID) return ROOT_CLIENT
      if (netUid === CHILD_NET_UID) return CHILD_CLIENT
      if (netUid === ORDINARY_NET_UID) return ORDINARY_CLIENT
      return null
    })
    apiMocks.getClientCommercialStructure.mockImplementation(async (netUid: string) => (
      netUid === ROOT_NET_UID ? ROOT_STRUCTURE : ORDINARY_STRUCTURE
    ))
    apiMocks.updateClient.mockImplementation(async (client: Client) => client)
  })

  it('keeps shared sections on the root and switches individual sections with the tree selection', async () => {
    renderPage(ROOT_NET_UID)

    expect(await screen.findByText(`general:${ROOT_NET_UID}`)).toBeTruthy()
    expect(screen.getByText('XM05200 — Хмельницький - Назаришин В. М.')).toBeTruthy()
    expect(screen.getByRole('button', {
      name: 'XM05201 — ФОП Назаришин Валерій Миколайович',
    })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'XM05202 — МАГРОМ ТОВ' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Договори$/ }))
    expect(await screen.findByText(`agreements:${ROOT_NET_UID}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'XM05202 — МАГРОМ ТОВ' }))
    expect(await screen.findByText(`agreements:${CHILD_NET_UID}`)).toBeTruthy()
    expect(screen.getAllByText('Дані вибраного клієнта').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Аналітики$/ }))
    expect(await screen.findByText(`analysts:${ROOT_NET_UID}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Договори$/ }))
    expect(await screen.findByText(`agreements:${CHILD_NET_UID}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => {
      expect(apiMocks.updateClient).toHaveBeenCalledWith(
        expect.objectContaining({ NetUid: CHILD_NET_UID }),
        { allowSourceOverride: false },
      )
    })
  })

  it('keeps structural-unit and subclient actions visible across the client card', async () => {
    renderPage(ROOT_NET_UID)

    expect(await screen.findByText(`general:${ROOT_NET_UID}`)).toBeTruthy()
    const structuralUnits = screen.getByRole('button', { name: 'Структурні підрозділи' })
    const subclients = screen.getByRole('button', { name: 'Сабклієнти' })

    expect(structuralUnits.getAttribute('aria-pressed')).toBe('false')
    expect(subclients.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(structuralUnits)
    expect(await screen.findByText(`relationship:structural-unit:${ROOT_NET_UID}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Структурні підрозділи' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Сабклієнти' }))
    expect(await screen.findByText(`relationship:subclient:${ROOT_NET_UID}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Сабклієнти' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps the standard flat form for a client that is not a root folder', async () => {
    renderPage(ORDINARY_NET_UID)

    expect(await screen.findByText(`general:${ORDINARY_NET_UID}`)).toBeTruthy()
    expect(screen.queryByText('Дерево клієнтів')).toBeNull()
    expect(screen.getByRole('button', { name: 'Структурні підрозділи' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Сабклієнти' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Договори$/ }))
    expect(await screen.findByText(`agreements:${ORDINARY_NET_UID}`)).toBeTruthy()
    expect(apiMocks.getClientById).toHaveBeenCalledTimes(1)
  })

  it('does not replace a newly selected card when an earlier save completes', async () => {
    const save = deferred<Client | null>()
    apiMocks.updateClient.mockReturnValueOnce(save.promise)
    renderPage(ROOT_NET_UID)

    expect(await screen.findByText(`general:${ROOT_NET_UID}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Договори$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'XM05202 — МАГРОМ ТОВ' }))
    expect(await screen.findByText(`agreements:${CHILD_NET_UID}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(apiMocks.updateClient).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', {
      name: 'XM05201 — ФОП Назаришин Валерій Миколайович',
    }))
    expect(await screen.findByText(`agreements:${ROOT_NET_UID}`)).toBeTruthy()

    save.resolve(CHILD_CLIENT)
    await waitFor(() => {
      expect(screen.getByText(`agreements:${ROOT_NET_UID}`)).toBeTruthy()
      expect(screen.queryByText(`agreements:${CHILD_NET_UID}`)).toBeNull()
    })
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

function renderPage(netUid: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/clients/edit/${netUid}/general-information?roleIds=1`]}>
          <Routes>
            <Route path="/clients/edit/:netid/:step" element={<ClientEditPage />} />
            <Route path="/clients" element={<div>Клієнти</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

const CLIENT_ROLE = {
  ClientType: { Type: 0 },
  ClientTypeRole: { Name: 'Покупці Україна' },
}

const ROOT_CLIENT: Client = {
  ClientInRole: CLIENT_ROLE,
  FullName: 'ФОП Назаришин Валерій Миколайович',
  Id: 10,
  IsActive: true,
  NetUid: ROOT_NET_UID,
  RegionCode: { Value: 'XM05201' },
}

const CHILD_CLIENT: Client = {
  ClientInRole: CLIENT_ROLE,
  FullName: 'МАГРОМ ТОВ',
  Id: 11,
  IsActive: true,
  IsTradePoint: true,
  NetUid: CHILD_NET_UID,
  RegionCode: { Value: 'XM05202' },
}

const ORDINARY_CLIENT: Client = {
  ClientInRole: CLIENT_ROLE,
  FullName: 'Звичайний клієнт',
  Id: 20,
  IsActive: true,
  NetUid: ORDINARY_NET_UID,
  RegionCode: { Value: 'XM10001' },
}

const ROOT_STRUCTURE = makeStructure([
  makeCard({
    ClientId: 10,
    ClientNetUid: ROOT_NET_UID,
    CurrentRegionCode: 'XM05201',
    DisplayName: 'ФОП Назаришин Валерій Миколайович',
    IsTarget: true,
  }),
  makeCard({
    ClientId: 11,
    ClientNetUid: CHILD_NET_UID,
    CurrentRegionCode: 'XM05202',
    DisplayName: 'МАГРОМ ТОВ',
    IsTradePoint: true,
    MainClientId: 10,
  }),
], {
  GroupCode: 'XM05200',
  GroupName: 'Хмельницький - Назаришин В. М.',
})

const ORDINARY_STRUCTURE = makeStructure([
  makeCard({
    ClientId: 20,
    ClientNetUid: ORDINARY_NET_UID,
    CurrentRegionCode: 'XM10001',
    DisplayName: 'Звичайний клієнт',
    IsTarget: true,
  }),
], {
  ClientNetUid: ORDINARY_NET_UID,
  GroupCode: null,
  GroupKey: 'XM100',
  GroupName: null,
  State: 'self',
})

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
