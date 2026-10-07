import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCollectionCoefficientCapabilities } from '../api/collectionCoefficientApi'
import { collectionCoefficientCapability, collectionCoefficientCatalogueEntry } from '../data/collectionCoefficient.test-fixtures'
import { CollectionCoefficientCatalogueLaunch } from './CollectionCoefficientCatalogueLaunch'

vi.mock('../api/collectionCoefficientApi', () => ({ getCollectionCoefficientCapabilities: vi.fn() }))
beforeEach(() => vi.mocked(getCollectionCoefficientCapabilities).mockReset())

it('opens the original captured catalogue identity only after an executable server capability arrives', async () => {
  const capability = collectionCoefficientCapability(), open = vi.fn(() => true)
  vi.mocked(getCollectionCoefficientCapabilities).mockResolvedValue(capability)
  render(<MantineProvider env="test"><I18nProvider><CollectionCoefficientCatalogueLaunch report={collectionCoefficientCatalogueEntry()}
    enabled disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  const button = screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect(open).toHaveBeenCalledWith(capability)
})

it('keeps a nonexecutable capability unavailable and does no capability request after permission is absent', async () => {
  const open = vi.fn(() => true)
  vi.mocked(getCollectionCoefficientCapabilities).mockResolvedValue({ ...collectionCoefficientCapability(), Executable: false })
  const view = render(<MantineProvider env="test"><I18nProvider><CollectionCoefficientCatalogueLaunch report={collectionCoefficientCatalogueEntry()}
    enabled disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  await screen.findByText('Сервер ще не підтримує формування цього конструктора.')
  expect((screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }) as HTMLButtonElement).disabled).toBe(true)
  vi.mocked(getCollectionCoefficientCapabilities).mockClear()
  view.rerender(<MantineProvider env="test"><I18nProvider><CollectionCoefficientCatalogueLaunch report={collectionCoefficientCatalogueEntry()}
    enabled={false} disabled={false} onOpen={open} /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити оригінальний конструктор' }))
  expect(getCollectionCoefficientCapabilities).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()
})
