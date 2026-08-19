import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { parseOrderVatPercentInput } from '../supplyUkraineOrderVatInput'
import type { SupplyOrderUkraine } from '../types'
import { SupplyUkraineOrderOverviewPage } from './SupplyUkraineOrderOverviewPage'

const apiMocks = vi.hoisted(() => ({
  addVatPercentToSupplyOrderUkraine: vi.fn(),
  getSupplyUkraineOrderForOverview: vi.fn(),
  manageSupplyOrderUkraineDocuments: vi.fn(),
  updateSupplyOrderUkraineItems: vi.fn(),
}))

const allowedPermissions = new Set<string>([
  PermissionKeys.OrdersUkraine.Order.OpenOverview,
  PermissionKeys.OrdersUkraine.Placement.Calculate,
])

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => allowedPermissions.has(permission) }),
}))

vi.mock('../api/supplyUkraineOrdersApi', () => apiMocks)

function renderPage(vatPercent: number) {
  apiMocks.getSupplyUkraineOrderForOverview.mockResolvedValue({
    NetUid: 'd530f9a2-dab9-4942-bbfd-bab3bf0dc5b3',
    SupplyOrderUkraineDocuments: [],
    SupplyOrderUkraineItems: [],
    VatPercent: vatPercent,
  } satisfies SupplyOrderUkraine)

  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/view/d530f9a2-dab9-4942-bbfd-bab3bf0dc5b3']}>
          <Routes>
            <Route path="/orders/ukraine/view/:id" element={<SupplyUkraineOrderOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

function typeDigitsAtCursor(input: HTMLInputElement, cursor: number, digits: string) {
  input.setSelectionRange(cursor, cursor)

  for (const digit of digits) {
    const applyBrowserInput = fireEvent.keyDown(input, { key: digit })

    if (applyBrowserInput) {
      const selectionStart = input.selectionStart ?? input.value.length
      const selectionEnd = input.selectionEnd ?? selectionStart
      const nextValue = `${input.value.slice(0, selectionStart)}${digit}${input.value.slice(selectionEnd)}`

      fireEvent.change(input, { target: { value: nextValue } })
      input.setSelectionRange(selectionStart + 1, selectionStart + 1)
    }
  }
}

describe('Supply Ukraine order VAT input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenOverview)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Placement.Calculate)
  })

  it('does not mount the overview model without overview access', () => {
    allowedPermissions.clear()
    renderPage(0)

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(apiMocks.getSupplyUkraineOrderForOverview).not.toHaveBeenCalled()
  })

  it('preserves the transient empty value instead of restoring zero', () => {
    expect(parseOrderVatPercentInput('')).toBeUndefined()
    expect(parseOrderVatPercentInput('2')).toBe(2)
    expect(parseOrderVatPercentInput('22')).toBe(22)
  })

  it('keeps the field empty while replacing zero with sequentially typed digits', async () => {
    renderPage(0)

    const input = await screen.findByRole('textbox', { name: 'Відсоток ПДВ' })

    fireEvent.change(input, { target: { value: '' } })
    expect((input as HTMLInputElement).value).toBe('')

    fireEvent.change(input, { target: { value: '2' } })
    expect((input as HTMLInputElement).value).toBe('2')

    fireEvent.change(input, { target: { value: '22' } })
    expect((input as HTMLInputElement).value).toBe('22')
  })

  it.each([
    ['before', 0],
    ['after', 1],
  ])('replaces the initial zero when typing digits %s it', async (_position, cursor) => {
    renderPage(0)

    const input = await screen.findByRole('textbox', { name: 'Відсоток ПДВ' }) as HTMLInputElement

    typeDigitsAtCursor(input, cursor, '22')

    expect(input.value).toBe('22')
  })

  it('keeps the existing upper VAT boundary', async () => {
    renderPage(20)

    const input = await screen.findByRole('textbox', { name: 'Відсоток ПДВ' })

    fireEvent.change(input, { target: { value: '101' } })

    expect((input as HTMLInputElement).value).toBe('100')
  })
})
