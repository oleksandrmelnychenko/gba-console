import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createProductGroup, getProductGroupCreateRootGroups, getProductGroups } from '../api/productGroupsApi'
import { ProductGroupsPage } from './ProductGroupsPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))
vi.mock('../api/productGroupsApi', () => ({
  createProductGroup: vi.fn(),
  getProductGroupCreateRootGroups: vi.fn(),
  getProductGroups: vi.fn(),
}))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({ DataTable: () => null }))

beforeEach(() => {
  vi.mocked(getProductGroups).mockResolvedValue({ ProductGroups: [], TotalFilteredQty: 0, TotalQty: 0 })
  vi.mocked(getProductGroupCreateRootGroups).mockResolvedValue([])
  vi.mocked(createProductGroup).mockReset()
})

it('«Нова група» with an empty Назва shows the message under the field and sends nothing', async () => {
  render(<MantineProvider><I18nProvider><MemoryRouter initialEntries={['/product-groups']}>
    <ProductGroupsPage />
  </MemoryRouter></I18nProvider></MantineProvider>)

  fireEvent.click(await screen.findByRole('button', { name: 'Нова група' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Створити' }))

  expect(await within(dialog).findByText('Вкажіть назву групи')).toBeTruthy()
  expect(within(dialog).getByRole('textbox', { name: /Назва/ }).getAttribute('aria-invalid')).toBe('true')
  expect(createProductGroup).not.toHaveBeenCalled()
})
