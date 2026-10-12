import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SaleDocumentWarehouseSelect } from './SaleDocumentWarehouseSelect'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../../shared/api/apiClient', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function renderSelect(value: number | null = null, disabled = false, flow: 'create' | 'edit' = 'create') {
  const onChange = vi.fn()
  const result = render(<MantineProvider env="test"><SaleDocumentWarehouseSelect value={value}
    flow={flow} disabled={disabled} onChange={onChange} /></MantineProvider>)
  return { ...result, onChange }
}

describe('document warehouse selection', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiRequest.mockResolvedValue([
      { Id: 1, Name: 'Свій', OrganizationId: 10 },
      { Id: 2, Name: 'Чужий', OrganizationId: 20 },
      { Id: 3, Name: 'Спільний', OrganizationId: null },
      { Id: 4, Name: 'Видалений', OrganizationId: 10, Deleted: true },
    ])
  })

  it('requires an explicit choice, allows routing associations and excludes deleted warehouses', async () => {
    const { onChange } = renderSelect()
    await act(async () => { await Promise.resolve() })
    const select = screen.getByRole('combobox', { name: 'Склад документа' })
    fireEvent.click(select)
    expect(screen.getByRole('option', { name: 'Свій' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Спільний' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Чужий' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Видалений' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('option', { name: 'Свій' }))
    expect(onChange).toHaveBeenCalledWith(1)
    expect(mocks.apiRequest).toHaveBeenCalledWith('/storages/sales-ukraine/create/document-warehouses',
      expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('keeps an unavailable historical selection visible and locked', async () => {
    const { onChange } = renderSelect(99, true, 'edit')
    await act(async () => { await Promise.resolve() })
    const select = screen.getByRole('combobox', { name: 'Склад документа' }) as HTMLInputElement
    expect(select.value).toBe('Склад №99')
    expect(select.disabled).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not invent a warehouse for an old posted document', async () => {
    const { onChange } = renderSelect(null, true, 'edit')
    await act(async () => { await Promise.resolve() })
    const select = screen.getByRole('combobox', { name: 'Склад документа' }) as HTMLInputElement
    expect(select.value).toBe('')
    expect(select.placeholder).toBe('Не вказано в документі')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows lookup failure and aborts the request when unmounted', async () => {
    mocks.apiRequest.mockRejectedValue(new Error('offline'))
    const { unmount, onChange } = renderSelect()
    await screen.findByText('Не вдалося завантажити склади')
    const signal = mocks.apiRequest.mock.calls[0][1].signal as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })
})
