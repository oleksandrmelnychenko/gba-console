import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { getWizardCartTotals } from './wizardCartTotals'
import { WizardCartSheet } from './WizardCartSheet'

vi.mock('./wizardCartTotals', async importOriginal => {
  const actual = await importOriginal<typeof import('./wizardCartTotals')>()
  return { ...actual, getWizardCartTotals: vi.fn(actual.getWizardCartTotals) }
})
vi.mock('../../../../shared/ui/AppBottomSheet', () => ({ AppBottomSheet: ({ opened, headerTools, children }: {
  opened: boolean; headerTools: ReactNode; children: ReactNode
}) => opened ? <div>{headerTools}{children}</div> : null }))

it('shares one totals calculation between the cart header, cards and table', () => {
  const items = [{ NetUid: 'item', Qty: 2, TotalAmount: 20, TotalAmountLocal: 800, Product: { VendorCode: 'CODE', CurrentPrice: 10 } }]
  const props = { busy: false, opened: true, localCurrencyCode: 'UAH', useEurToUah: false,
    onClose: vi.fn(), onOpen: vi.fn(), onEditCart: vi.fn(), onRowClick: vi.fn() }
  const ui = (rows = items) => <MantineProvider env="test"><I18nProvider><WizardCartSheet {...props} items={rows} /></I18nProvider></MantineProvider>
  vi.mocked(getWizardCartTotals).mockClear()
  const view = render(ui())
  expect(getWizardCartTotals).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByLabelText('Таблиця'))
  expect(getWizardCartTotals).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByLabelText('Картки'))
  expect(getWizardCartTotals).toHaveBeenCalledOnce()
  view.rerender(ui([{ ...items[0], Qty: 3, TotalAmount: 30 }]))
  expect(getWizardCartTotals).toHaveBeenCalledTimes(2)
  expect(screen.getAllByText('30,00').length).toBeGreaterThan(0)
})
