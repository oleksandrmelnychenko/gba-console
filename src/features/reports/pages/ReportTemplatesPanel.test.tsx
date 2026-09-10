import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createSalesReportPreset } from '../data/reportPresets'
import type { ReportTemplate } from '../types'
import { ReportTemplatesPanel } from './ReportTemplatesPanel'

type Props = ComponentProps<typeof ReportTemplatesPanel>
const first: ReportTemplate = { ...createSalesReportPreset('agreements', '', '', []), Id: 'first', Revision: 4, Name: 'Договори' }
const second: ReportTemplate = { ...createSalesReportPreset('daily', '', '', []), Id: 'second', Revision: 2, Name: 'За днями' }
function props(): Props {
  return { storage: { templates: [first, second], busy: false, ready: true, notice: null, browserTemplates: [], reload: vi.fn(),
    save: vi.fn().mockResolvedValue({ ok: true }), update: vi.fn().mockResolvedValue({ ok: true }),
    rename: vi.fn().mockResolvedValue({ ok: true, template: { ...first, Name: 'Перейменовано', Revision: 5 } }),
    copy: vi.fn().mockResolvedValue({ ok: true, template: { ...second, Id: 'copy', Revision: 1 } }),
    remove: vi.fn().mockResolvedValue({ ok: true }), importBrowserTemplate: vi.fn().mockResolvedValue({ ok: true }) },
    configurationReady: true, notice: null, templateName: 'Поточний draft', activeTemplate: null,
    onNameChange: vi.fn(), onApply: vi.fn(), onSave: vi.fn().mockResolvedValue({ ok: true }), onUpdate: vi.fn().mockResolvedValue({ ok: true }),
    onRenamed: vi.fn(), onDeleted: vi.fn(), onRefresh: vi.fn(), onClearNotice: vi.fn() }
}
function view(p: Props) { return render(<MantineProvider env="test"><I18nProvider><ReportTemplatesPanel {...p} /></I18nProvider></MantineProvider>) }
function row(name: string) { return within(screen.getByRole('group', { name })) }

describe('shared saved-template workflow', () => {
  it('opens a saved template and exposes draft update only for the named opened template', () => {
    const p = props(); const v = view(p)
    expect(screen.queryByRole('button', { name: 'Оновити шаблон' })).toBeNull()
    fireEvent.click(row(first.Name).getByRole('button', { name: /Договори/ }))
    expect(p.onApply).toHaveBeenCalledWith(first)
    v.unmount(); view({ ...p, activeTemplate: first })
    expect(screen.getByText('Відкритий шаблон: Договори')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Оновити шаблон' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    expect(p.onUpdate).toHaveBeenCalledOnce()
    expect(p.storage.update).not.toHaveBeenCalled()
  })

  it('renames the chosen stored template with explicit confirmation and success-only completion', async () => {
    const p = props(); view(p)
    fireEvent.click(row(first.Name).getByRole('button', { name: 'Перейменувати' }))
    const region = screen.getByRole('region', { name: 'Перейменувати шаблон' })
    expect(within(region).getByText('Шаблон: Договори')).toBeTruthy()
    fireEvent.change(within(region).getByLabelText('Нова назва'), { target: { value: 'Перейменовано' } })
    expect(p.storage.rename).not.toHaveBeenCalled()
    fireEvent.click(within(region).getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(p.onRenamed).toHaveBeenCalledWith({ ...first, Name: 'Перейменовано', Revision: 5 }, first))
    expect(p.storage.rename).toHaveBeenCalledWith(first, 'Перейменовано')
    expect(p.onApply).not.toHaveBeenCalled(); expect(p.onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Перейменувати шаблон' })).toBeNull()
  })

  it('copies another stored template without replacing the opened draft', async () => {
    const p = props(); view({ ...p, activeTemplate: first })
    fireEvent.click(row(second.Name).getByRole('button', { name: 'Створити копію' }))
    const region = screen.getByRole('region', { name: 'Створити копію шаблону' })
    fireEvent.change(within(region).getByLabelText('Назва копії'), { target: { value: 'Моя копія' } })
    fireEvent.click(within(region).getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(p.storage.copy).toHaveBeenCalledWith(second, 'Моя копія'))
    expect(p.onApply).not.toHaveBeenCalled(); expect(p.onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('Відкритий шаблон: Договори')).toBeTruthy()
  })

  it('confirms the named delete, preserves its prompt on conflict and clears active identity only on success', async () => {
    const p = props(); vi.mocked(p.storage.remove).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true }); view(p)
    fireEvent.click(row(second.Name).getByRole('button', { name: 'Видалити' }))
    const region = screen.getByRole('region', { name: 'Видалити шаблон' })
    expect(within(region).getByText('Шаблон: За днями')).toBeTruthy(); expect(p.storage.remove).not.toHaveBeenCalled()
    fireEvent.click(within(region).getByRole('button', { name: 'Підтвердити видалення' }))
    await waitFor(() => expect(p.storage.remove).toHaveBeenCalledWith(second.Id, second.Revision))
    expect(p.onDeleted).not.toHaveBeenCalled(); expect(region).toBeTruthy()
    fireEvent.click(within(region).getByRole('button', { name: 'Підтвердити видалення' }))
    await waitFor(() => expect(p.onDeleted).toHaveBeenCalledWith(second.Id))
    expect(screen.queryByRole('region', { name: 'Видалити шаблон' })).toBeNull()
  })

  it('searches saved names and refuses stale or disabled draft updates', () => {
    const p = props(); const v = view({ ...p, activeTemplate: { ...first, Revision: 3 } })
    expect((screen.getByRole('button', { name: 'Оновити шаблон' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Пошук шаблонів'), { target: { value: 'ДНЯМИ' } })
    expect(screen.queryByRole('group', { name: first.Name })).toBeNull()
    expect(screen.getByRole('group', { name: second.Name })).toBeTruthy()
    v.unmount(); view({ ...p, disabled: true, activeTemplate: first })
    for (const name of ['Перейменувати', 'Створити копію', 'Видалити']) expect((row(first.Name).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Оновити шаблон' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
