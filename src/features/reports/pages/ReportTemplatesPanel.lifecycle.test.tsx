import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ReportTemplatesPanel } from './ReportTemplatesPanel'

type Props = ComponentProps<typeof ReportTemplatesPanel>
function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    storage: { templates: [], busy: false, ready: true, notice: null, browserTemplates: [],
      reload: vi.fn(), save: vi.fn(), update: vi.fn(), rename: vi.fn(), copy: vi.fn(), remove: vi.fn(), importBrowserTemplate: vi.fn() },
    configurationReady: true, notice: null, templateName: '', activeTemplate: null,
    onNameChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn().mockResolvedValue({ ok: true }), onUpdate: vi.fn(),
    onRenamed: vi.fn(), onDeleted: vi.fn(), onRefresh: vi.fn(), onClearNotice: vi.fn(), ...overrides,
  }
  function Harness() {
    const [name, setName] = useState('')
    return <ReportTemplatesPanel {...props} templateName={name} onNameChange={setName} />
  }
  render(<MantineProvider env="test"><I18nProvider><Harness /></I18nProvider></MantineProvider>)
  return props
}

describe('template library states', () => {
  it('keeps a failed save editable, then returns to the list only after success', async () => {
    const onSave = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true })
    const p = setup({ onSave })
    expect(screen.queryByLabelText('Назва шаблону')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Новий шаблон' }))
    expect(screen.queryByRole('region', { name: 'Збережені шаблони' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Назва шаблону'), { target: { value: 'Мій звіт' } })
    fireEvent.keyDown(screen.getByLabelText('Назва шаблону'), { key: 'Enter' })
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect((screen.getByLabelText('Назва шаблону') as HTMLInputElement).value).toBe('Мій звіт')
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await screen.findByRole('region', { name: 'Збережені шаблони' })
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(p.onApply).not.toHaveBeenCalled()
    expect(p.onUpdate).not.toHaveBeenCalled()
  })

  it('does not call an empty or whitespace name a saveable template', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Новий шаблон' }))
    fireEvent.change(screen.getByLabelText('Назва шаблону'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText('Назва шаблону'), { key: 'Enter' })
    expect(p.onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(screen.getByRole('region', { name: 'Збережені шаблони' })).toBeTruthy()
  })

  it.each(['loading', 'failed'] as const)('does not show an empty library while %s', state => {
    setup({ storage: { templates: [], busy: false, ready: false, notice: null, browserTemplates: [], reload: vi.fn(),
      save: vi.fn(), update: vi.fn(), rename: vi.fn(), copy: vi.fn(), remove: vi.fn(), importBrowserTemplate: vi.fn() },
      notice: state === 'failed' ? 'Немає з’єднання' : null })
    expect(screen.queryByText('Збережених шаблонів ще немає')).toBeNull()
    if (state === 'loading') expect(screen.getByRole('status', { name: 'Завантаження шаблонів' })).toBeTruthy()
    else expect(screen.getByRole('alert').textContent).toContain('Немає з’єднання')
    expect((screen.getByRole('button', { name: 'Оновити список' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Новий шаблон' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
