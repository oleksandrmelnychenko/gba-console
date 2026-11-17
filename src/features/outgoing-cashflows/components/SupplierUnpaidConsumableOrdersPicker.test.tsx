import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SupplierUnpaidConsumableOrdersPicker } from './SupplierUnpaidConsumableOrdersPicker'

function renderPicker(error: string | null) {
  render(
    <MantineProvider>
      <I18nProvider>
        <SupplierUnpaidConsumableOrdersPicker
          error={error}
          orders={[]}
          selectedAmount={0}
          selectedCount={0}
          selectedValues={[]}
          onChange={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('SupplierUnpaidConsumableOrdersPicker', () => {
  it('shows a failed lookup as an error, not as «no unpaid invoices»', () => {
    renderPicker('Не вдалося виконати запит')

    expect(screen.getByText(/Не вдалося завантажити неоплачені накладні/)).toBeTruthy()
    expect(screen.queryByText('Неоплачених накладних не знайдено')).toBeNull()
  })

  it('keeps the empty state for a successful empty answer', () => {
    renderPicker(null)

    expect(screen.getByText('Неоплачених накладних не знайдено')).toBeTruthy()
  })
})
