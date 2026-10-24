import { StrictMode } from 'react'
import type { WizardSaleRegisterItem, WizardSaleRegisterQuery } from './wizardClientStepApi'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { Client } from '../../../clients/types'

const apiMocks = vi.hoisted(() => ({
  getWizardClientAgreements: vi.fn(async () => []),
  getWizardClientGroupedDebts: vi.fn(async () => []),
  getWizardSalesRegister: vi.fn<(query: WizardSaleRegisterQuery, signal?: AbortSignal) => Promise<WizardSaleRegisterItem[]>>(async () => []),
  searchWizardClients: vi.fn<() => Promise<Client[]>>(async () => []),
}))

vi.mock('./wizardClientStepApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./wizardClientStepApi')>()

  return {
    ...original,
    getWizardClientAgreements: apiMocks.getWizardClientAgreements,
    getWizardClientGroupedDebts: apiMocks.getWizardClientGroupedDebts,
    getWizardSalesRegister: apiMocks.getWizardSalesRegister,
    searchWizardClients: apiMocks.searchWizardClients,
  }
})

vi.mock('../../../../shared/realtime/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/realtime/events')>()

  return { ...original, useRealtimeEvent: () => {} }
})

vi.mock('../../usePersistentSaleJsonMutation', () => ({
  usePersistentSaleJsonMutationRunner: () => vi.fn(),
}))

import { NewSaleClientStep } from './NewSaleClientStep'
import { dispatchWizardKey, resetWizardKeyboard } from './wizardKeyboard'

describe('new-sale client keyboard navigation', () => {
  beforeEach(() => {
    resetWizardKeyboard()
    vi.clearAllMocks()
  })

  it('reloads a preserved client after StrictMode retires the first mount requests', async () => {
    const client = createClient(1, 'CN02101')
    const onAgreementChange = vi.fn()
    render(
      <StrictMode><MantineProvider><I18nProvider>
        <NewSaleClientStep clientNetId={client.NetUid ?? null} initialClient={client}
          onAgreementChange={onAgreementChange} onClientChange={() => {}} onOpenSale={() => {}} />
      </I18nProvider></MantineProvider></StrictMode>,
    )
    await waitFor(() => expect(apiMocks.getWizardSalesRegister).toHaveBeenCalledTimes(2))
    expect(apiMocks.getWizardSalesRegister.mock.calls[0][1]?.aborted).toBe(true)
    expect(apiMocks.getWizardSalesRegister.mock.calls[1][1]?.aborted).toBe(false)
    expect(apiMocks.getWizardClientAgreements).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByTestId('wizard-selected-client').getAttribute('data-client-net-uid')).toBe(client.NetUid))
  })

  it('previews a structural search result with an arrow and opens it only on Enter', async () => {
    const ordinary = createClient(1, 'CN02101')
    const folder = createClient(2, 'VI02100')
    const child = createClient(3, 'VI02101')
    folder.SubClients = [{ Id: 1, SubClient: child }]
    apiMocks.searchWizardClients.mockResolvedValueOnce([ordinary, folder])
    const onClientChange = vi.fn()

    render(
      <MantineProvider>
        <I18nProvider>
          <div onKeyDown={(event) => dispatchWizardKey(event)}>
            <NewSaleClientStep
              clientNetId={null}
              onAgreementChange={() => {}}
              onClientChange={onClientChange}
              onOpenSale={() => {}}
            />
          </div>
        </I18nProvider>
      </MantineProvider>,
    )

    const search = screen.getByPlaceholderText('Місце вводу для пошуку')
    fireEvent.change(search, { target: { value: '02100' } })
    await waitFor(() => expect(screen.getAllByText('VI02100')).toHaveLength(2), { timeout: 3_000 })

    fireEvent.keyDown(search, { key: 'ArrowDown' })

    await waitFor(
      () =>
        expect(screen.getByTestId('wizard-selected-client').getAttribute('data-client-net-uid')).toBe(
          folder.NetUid?.toLowerCase(),
        ),
      { timeout: 3_000 },
    )
    expect(onClientChange).not.toHaveBeenCalled()
    expect(apiMocks.getWizardClientAgreements).not.toHaveBeenCalled()
    expect(apiMocks.getWizardClientGroupedDebts).not.toHaveBeenCalled()

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => expect(screen.getAllByText('VI02101')).toHaveLength(2), { timeout: 3_000 })
  })

  it('selects a real IF01200 client instead of treating its 00 suffix as an empty folder', async () => {
    const client = createClient(574259, 'IF01200')
    client.FullName = 'Івано Франківськ - ТОВ "Електроавтотранс"'
    apiMocks.searchWizardClients.mockResolvedValueOnce([client])
    const onClientChange = vi.fn()

    render(
      <MantineProvider>
        <I18nProvider>
          <div onKeyDown={(event) => dispatchWizardKey(event)}>
            <NewSaleClientStep
              clientNetId={null}
              onAgreementChange={() => {}}
              onClientChange={onClientChange}
              onOpenSale={() => {}}
            />
          </div>
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.change(screen.getByPlaceholderText('Місце вводу для пошуку'), {
      target: { value: 'IF01200' },
    })

    await waitFor(() => expect(onClientChange).toHaveBeenCalledWith(client.NetUid), { timeout: 3_000 })
    expect(apiMocks.getWizardClientAgreements).toHaveBeenCalledWith(client.NetUid)
    expect(apiMocks.getWizardClientGroupedDebts).toHaveBeenCalledWith(client.NetUid)
  })

  it('clears the previous selection immediately on typing and does not reconfirm it with Enter', async () => {
    const client = createClient(1, 'CN02101')
    const onClientChange = vi.fn()
    render(
      <MantineProvider><I18nProvider>
        <div onKeyDown={dispatchWizardKey}>
          <NewSaleClientStep clientNetId={client.NetUid ?? null} initialClient={client}
            onAgreementChange={() => {}} onClientChange={onClientChange} onOpenSale={() => {}} />
        </div>
      </I18nProvider></MantineProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('wizard-selected-client')).toBeTruthy())
    onClientChange.mockClear()
    const search = screen.getByPlaceholderText('Місце вводу для пошуку')
    fireEvent.change(search, { target: { value: 'new query' } })
    expect(screen.queryByTestId('wizard-selected-client')).toBeNull()
    expect(search.classList.contains('is-hidden')).toBe(false)
    expect(onClientChange).toHaveBeenCalledWith(null)
    onClientChange.mockClear()
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onClientChange).not.toHaveBeenCalled()
  })
})

function createClient(id: number, code: string): Client {
  return {
    FullName: code,
    Id: id,
    IsActive: true,
    NetUid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    RegionCode: { Value: code },
  }
}
