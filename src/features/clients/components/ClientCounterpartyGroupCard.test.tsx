import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ClientCounterpartyGroupCard } from './ClientCounterpartyGroupCard'

const mocks = vi.hoisted(() => ({ placement: vi.fn(), tree: vi.fn(), move: vi.fn() }))

vi.mock('../api/counterpartyGroupsApi', () => ({
  getClientCounterpartyGroup: mocks.placement,
  getCounterpartyGroupTree: mocks.tree,
  moveClientsToCounterpartyGroup: mocks.move,
}))

const client = '00000000-0000-0000-0000-000000000099'
const buyers = '00000000-0000-0000-0000-000000000001'
const kyiv = '00000000-0000-0000-0000-000000000004'

function renderCard(canEdit: boolean) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ClientCounterpartyGroupCard canEdit={canEdit} clientNetUid={client} />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ClientCounterpartyGroupCard', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.placement.mockResolvedValue({ ClientNetUid: client, GroupNetUid: buyers, GroupName: 'Без групи',
      GroupPath: 'Покупці / Без групи', IsPlaced: false, IsManuallyPlaced: false })
    mocks.tree.mockResolvedValue([
      { NetUid: buyers, ParentNetUid: null, Key: '8AB2005056C0000811DEFC4535BB4D40', Name: 'Покупці', Code: null, RegionCode: null,
        IsSystem: true, IsUngrouped: false, IsFromOneC: true, IsManuallyEdited: false, ClientCount: 0 },
      { NetUid: kyiv, ParentNetUid: buyers, Key: 'AB', Name: 'Київ', Code: null, RegionCode: null,
        IsSystem: false, IsUngrouped: false, IsFromOneC: false, IsManuallyEdited: true, ClientCount: 0 },
    ])
    mocks.move.mockResolvedValue(1)
  })

  it('shows the group of the client and moves it to another group', async () => {
    renderCard(true)
    expect(await screen.findByText('Покупці / Без групи')).toBeTruthy()
    expect(screen.getByText('без групи')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Змінити групу' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Група контрагентів' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Покупці / Київ', hidden: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити', hidden: true }))
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith([client], kyiv))
    await waitFor(() => expect(mocks.placement).toHaveBeenCalledTimes(2))
  })

  it('offers no change without the client edit permission', async () => {
    renderCard(false)
    expect(await screen.findByText('Покупці / Без групи')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Змінити групу' })).toBeNull()
  })
})
