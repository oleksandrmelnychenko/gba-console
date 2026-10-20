import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { ToolbarDateRangeFilter } from './ToolbarDateRangeFilter'

function setup() {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <form onSubmit={onSubmit}>
          <ToolbarDateRangeFilter
            from="2026-10-01"
            to="2026-10-20"
            min="2026-01-01"
            max="2026-12-31"
            onChange={onChange}
          />
        </form>
      </I18nProvider>
    </MantineProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
  return { onChange, onSubmit }
}

describe('ToolbarDateRangeFilter', () => {
  it('applies both draft dates once without submitting the surrounding document form', () => {
    const { onChange, onSubmit } = setup()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-02' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-10-18' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-10-02', to: '2026-10-18' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('discards canceled edits and restores the applied range when reopened', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-10-01')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects reversed ranges and keeps caller-provided date bounds', () => {
    const { onChange } = setup()
    const from = screen.getByLabelText('Від') as HTMLInputElement
    const to = screen.getByLabelText('До') as HTMLInputElement
    expect(from.min).toBe('2026-01-01')
    expect(from.max).toBe('2026-10-20')
    expect(to.min).toBe('2026-10-01')
    expect(to.max).toBe('2026-12-31')
    fireEvent.change(from, { target: { value: '2026-10-25' } })
    expect(screen.getByRole('alert').textContent).toContain('Дата «Від»')
    expect((screen.getByRole('button', { name: 'Застосувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
