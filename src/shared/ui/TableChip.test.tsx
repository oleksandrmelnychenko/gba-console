import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableChip } from './TableChip'

describe('TableChip values', () => {
  it('keeps empty markers as plain text and does not hide zero', () => {
    const { container } = render(<><TableChip value={null} /><TableChip value="" /><TableChip value="—" /><TableChip value="-" /><TableChip value={0} /></>)
    expect(container.querySelectorAll('.app-table-chip')).toHaveLength(1)
    expect(screen.getByText('0').closest('.app-table-chip')).toBeTruthy()
    expect(screen.getByText('—').closest('.app-table-chip')).toBeNull()
  })

  it('keeps a full value available when the label is truncated', () => {
    const value = 'Договір поставки з довгою назвою контрагента'
    render(<TableChip value={value} />)
    expect(screen.getByTitle(value).textContent).toBe(value)
  })

  it('distinguishes exception warehouses from ordinary storage', () => {
    const { container } = render(<><TableChip tone="storage" value="СКЛАД-3" /><TableChip tone="storage" value="Брак" /><TableChip tone="storage" value="Уцінка" /></>)
    expect(container.querySelector('.is-storage')?.textContent).toBe('СКЛАД-3')
    expect(container.querySelector('.is-danger')?.textContent).toBe('Брак')
    expect(container.querySelector('.is-warning')?.textContent).toBe('Уцінка')
  })
})
