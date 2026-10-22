import { Drawer, MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { ToolbarDateRangeFilter } from './ToolbarDateRangeFilter'

function setup(required = false) {
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
            required={required}
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

  it.each(['Від', 'До', 'Застосувати', 'Скасувати', 'Період'])('Escape on %s cancels only the picker inside a Drawer', (target) => {
    const onClose = vi.fn()
    const onChange = vi.fn()
    render(<MantineProvider env="test"><I18nProvider>
      <Drawer opened onClose={onClose} title="Картка товару">
        <ToolbarDateRangeFilter from="2026-10-01" to="2026-10-20" onChange={onChange} />
      </Drawer>
    </I18nProvider></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-05' } })
    const control = target === 'Період' ? screen.getByRole('dialog', { name: 'Період' })
      : target === 'Від' || target === 'До' ? screen.getByLabelText(target)
        : screen.getByRole('button', { name: target })
    fireEvent.keyDown(control, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Період' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Картка товару' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-10-01')
    fireEvent.keyDown(screen.getByLabelText('Від'), { key: 'Escape', code: 'Escape' })
    fireEvent.keyDown(screen.getByRole('button', { name: /^Період:/ }), { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledExactlyOnceWith()
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
  it('rejects blank required dates without applying, including direct form submission', () => {
    const { onChange, onSubmit } = setup(true)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '' } })
    expect(screen.getByRole('alert').textContent).toContain('Вкажіть дату початку')
    expect((screen.getByRole('button', { name: 'Застосувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('button', { name: 'Застосувати' }).closest('form')!)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each(['1899-12-31', '2027-01-01'])('rejects required dates outside caller bounds: %s', from => {
    const { onChange } = setup(true)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: from } })
    expect(screen.getByRole('alert').textContent).toContain('дозволеного періоду')
    fireEvent.submit(screen.getByRole('button', { name: 'Застосувати' }).closest('form')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts a same-day required interval', () => {
    const { onChange } = setup(true)
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-10-20', to: '2026-10-20' })
  })

  it('keeps optional empty bounds supported for other consumers', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '', to: '2026-10-20' })
  })

  it('refreshes presets on reopening after Kyiv midnight, including the month boundary', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-31T21:59:59Z'))
      const { onChange } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Сьогодні' }))
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-10-31')
      fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

      vi.setSystemTime(new Date('2026-10-31T22:00:01Z'))
      fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Сьогодні' }))
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-11-01')
      expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-11-01')
      fireEvent.click(screen.getByRole('button', { name: '7 днів' }))
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-10-26')
      fireEvent.click(screen.getByRole('button', { name: 'Минулий місяць' }))
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-10-01')
      expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-10-31')
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-10-01', to: '2026-10-31' })
    } finally {
      vi.useRealTimers()
    }
  })

})
