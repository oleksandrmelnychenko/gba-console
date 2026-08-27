import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { CashFlowGrid } from './CashFlowGrid'

const item = {
  CurrentBalance: 100,
  CurrentValue: 25,
  IsCreditValue: false,
  Name: 'Видимий рух коштів',
}

function renderGrid(onRowClick?: () => void) {
  render(
    <I18nProvider>
      <CashFlowGrid
        items={[item]}
        leadColumns={[{
          cell: (row) => row.Name,
          id: 'name',
        }]}
        onRowClick={onRowClick}
      />
    </I18nProvider>,
  )
}

describe('CashFlowGrid permission-neutral row interaction', () => {
  it('keeps data visible but disables the row when no action is supplied', () => {
    renderGrid()

    const row = screen.getByRole('button', { name: /Видимий рух коштів/ }) as HTMLButtonElement

    expect(row.disabled).toBe(true)
    expect(row.classList.contains('cfg-data-row-clickable')).toBe(false)
  })

  it('enables the row only when the consumer supplies a permitted action', () => {
    const onRowClick = vi.fn()
    renderGrid(onRowClick)

    const row = screen.getByRole('button', { name: /Видимий рух коштів/ }) as HTMLButtonElement
    fireEvent.click(row)

    expect(row.disabled).toBe(false)
    expect(row.classList.contains('cfg-data-row-clickable')).toBe(true)
    expect(onRowClick).toHaveBeenCalledOnce()
  })
})
