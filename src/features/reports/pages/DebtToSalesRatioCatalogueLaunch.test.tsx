import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDebtToSalesRatioCapabilities } from '../api/debtToSalesRatioApi'
import { debtRatioCapability, debtRatioCatalogueEntry } from '../data/debtToSalesRatio.test-fixtures'
import { DebtToSalesRatioCatalogueLaunch } from './DebtToSalesRatioCatalogueLaunch'

vi.mock('../api/debtToSalesRatioApi', () => ({ getDebtToSalesRatioCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getDebtToSalesRatioCapabilities).mockReset())

it('opens the original captured catalogue identity only after an executable server capability arrives', async () => {
  const capability = debtRatioCapability(), open = vi.fn(() => true)
  vi.mocked(getDebtToSalesRatioCapabilities).mockResolvedValue(capability)
  render(<MantineProvider env="test"><I18nProvider><DebtToSalesRatioCatalogueLaunch report={debtRatioCatalogueEntry()}
    enabled disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('keeps a nonexecutable capability unavailable and does no capability request after permission is absent', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getDebtToSalesRatioCapabilities).mockResolvedValue({ ...debtRatioCapability(), Executable: false })
  const view = render(<MantineProvider env="test"><I18nProvider><DebtToSalesRatioCatalogueLaunch report={debtRatioCatalogueEntry()}
    enabled disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  expect((screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }) as HTMLButtonElement).disabled).toBe(true)
  vi.mocked(getDebtToSalesRatioCapabilities).mockClear()
  view.rerender(<MantineProvider env="test"><I18nProvider><DebtToSalesRatioCatalogueLaunch report={debtRatioCatalogueEntry()}
    enabled={false} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(getDebtToSalesRatioCapabilities).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()
})
