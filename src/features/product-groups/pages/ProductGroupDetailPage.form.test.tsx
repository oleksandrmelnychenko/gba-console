import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductGroupDetailsRootGroups, getProductGroupWithRoot, updateProductGroup } from '../api/productGroupsApi'
import type { ProductGroup } from '../types'
import { ProductGroupDetailPage } from './ProductGroupDetailPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))
vi.mock('../api/productGroupsApi', () => ({
  getProductGroupDetailsRootGroups: vi.fn(),
  getProductGroupWithRoot: vi.fn(),
  updateProductGroup: vi.fn(),
}))
vi.mock('../components/ProductGroupProductsPanel', () => ({ ProductGroupProductsPanel: () => null }))
vi.mock('../components/ProductGroupSubGroupsPanel', () => ({ ProductGroupSubGroupsPanel: () => null }))

const GROUP: ProductGroup = {
  Description: 'Гальма',
  IsActive: true,
  Name: 'Brakes',
  NetUid: 'group-1',
  ProductProductGroups: [],
  RootProductGroups: [],
  SubProductGroups: [],
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderCard() {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/product-groups/group-1']}>
          <Routes>
            <Route path="/product-groups/:id" element={<ProductGroupDetailPage />} />
            <Route path="/product-groups" element={null} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('product group card form', () => {
  beforeEach(() => {
    vi.mocked(getProductGroupWithRoot).mockReset().mockResolvedValue(GROUP)
    vi.mocked(getProductGroupDetailsRootGroups).mockResolvedValue([])
    vi.mocked(updateProductGroup).mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the empty-name error under «Назва» and does not save', async () => {
    renderCard()
    const name = await screen.findByRole('textbox', { name: /Назва/ })
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Вкажіть назву групи')).toBeTruthy()
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(updateProductGroup).not.toHaveBeenCalled()
  })

  it('reports a save conflict in Ukrainian with a reload action', async () => {
    vi.mocked(updateProductGroup).mockRejectedValueOnce(Object.assign(new Error('The product group changed after it was loaded.'), { status: 409 }))
    renderCard()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Опис' }), { target: { value: 'Нове' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText(/Групу змінив інший користувач/)).toBeTruthy()
    expect(screen.queryByText(/changed after it was loaded/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Перезавантажити' }))
    await waitFor(() => expect(getProductGroupWithRoot).toHaveBeenCalledTimes(2))
  })

  it('asks before closing with unsaved changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderCard()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Опис' }), { target: { value: 'Нове' } })

    fireEvent.click(screen.getAllByRole('button', { name: /Закрити/ })[0])
    expect(confirm).toHaveBeenCalledWith('Є незбережені зміни. Закрити без збереження?')
    expect(screen.getByTestId('location').textContent).toBe('/product-groups/group-1')

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getAllByRole('button', { name: /Закрити/ })[0])
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/product-groups'))
  })
})
