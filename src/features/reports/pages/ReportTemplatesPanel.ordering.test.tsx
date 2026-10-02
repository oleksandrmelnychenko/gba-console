import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportTemplateOrderState, orderReportTemplates } from '../api/reportTemplateOrderApi'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { useServerReportTemplates } from '../hooks/useServerReportTemplates'
import type { ReportTemplate } from '../types'
import { ReportTemplatesPanel } from './ReportTemplatesPanel'

vi.mock('../api/reportWorkspaceApi', () => ({ getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(), deleteServerReportTemplate: vi.fn() }))
vi.mock('../api/reportTemplateOrderApi', () => ({ getReportTemplateOrderState: vi.fn(), orderReportTemplates: vi.fn() }))
const session = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
const first = { ...createSalesReportPreset('daily', '', '', []), Id: '11111111-1111-1111-1111-111111111111', Name: 'Договори', Revision: 3 }
const second = { ...createSalesReportPreset('agreements', '', '', []), Id: '22222222-2222-2222-2222-222222222222', Name: 'За днями', Revision: 7 }
const draft = { ...first.Data, from: '2026-09-02' }
let rows: ReportTemplate[], revision: number
const orderState = () => ({ ListRevision: revision, Items: rows.map((item, index) => ({ Id: item.Id!, Name: item.Name, Revision: item.Revision!, DisplayOrder: index + 1 })) })
const apply = vi.fn()
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); saveSession(session); rows = [first, second]; revision = 9
  vi.mocked(getServerReportTemplates).mockImplementation(async () => rows)
  vi.mocked(getReportTemplateOrderState).mockImplementation(async () => orderState())
  vi.mocked(orderReportTemplates).mockImplementation(async command => {
    if (command.Operation === 'move_up' || command.Operation === 'move_down') rows = [...rows].reverse()
    revision++; return orderState()
  })
})
afterEach(clearSession)
function Harness({ enabled = true, caller = session.userNetUid }: { enabled?: boolean; caller?: string }) {
  const storage = useServerReportTemplates(enabled, [], caller)
  const [name, setName] = useState('Моя чернетка')
  return <><output aria-label="Налаштування чернетки">{JSON.stringify(draft)}</output>
    <ReportTemplatesPanel storage={storage} ordering={storage.ordering} callerKey={caller} configurationReady
      disabled={!enabled} notice={storage.notice} templateName={name} activeTemplate={first} onNameChange={setName}
      onApply={apply} onSave={vi.fn()} onUpdate={vi.fn()} onRenamed={vi.fn()} onDeleted={vi.fn()}
      onClearNotice={vi.fn()} onRefresh={storage.reload} /></>
}
function view(props: { enabled?: boolean; caller?: string } = {}) {
  return render(<MantineProvider env="test"><I18nProvider><Harness {...props} /></I18nProvider></MantineProvider>)
}
async function openOrder() {
  await waitFor(() => expect((screen.getByRole('button', { name: 'Порядок шаблонів' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Порядок шаблонів' }))
  await screen.findByRole('combobox', { name: 'Шаблон у повному списку' })
}
async function select(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Шаблон у повному списку' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

it('uses full-list positions under search and leaves the edited draft untouched when moving a stored template', async () => {
  view(); await openOrder()
  fireEvent.change(screen.getByLabelText('Пошук шаблонів'), { target: { value: second.Name } })
  expect(screen.queryByRole('group', { name: first.Name })).toBeNull()
  await select('2. За днями')
  expect((screen.getByRole('button', { name: 'Опустити' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Підняти' }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Підняти' }))
  await waitFor(() => expect(orderReportTemplates).toHaveBeenCalledWith({ Operation: 'move_up', Id: second.Id }, 9, expect.any(Object)))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Шаблон у повному списку' }) as HTMLInputElement).value).toBe('1. За днями'))
  expect((screen.getByRole('button', { name: 'Підняти' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Назва шаблону') as HTMLInputElement).value).toBe('Моя чернетка')
  expect(screen.getByLabelText('Налаштування чернетки').textContent).toBe(JSON.stringify(draft))
  expect(saveServerReportTemplate).not.toHaveBeenCalled(); expect(deleteServerReportTemplate).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled()
})

it('labels transfer as a GBA full-list position and sends only the chosen stored identity and position', async () => {
  view(); await openOrder(); await select('1. Договори')
  expect((screen.getByRole('button', { name: 'Підняти' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Позиція у повному списку GBA'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити на позицію' }))
  await waitFor(() => expect(orderReportTemplates).toHaveBeenCalledWith({ Operation: 'transfer', Id: first.Id, Position: 2 }, 9, expect.any(Object)))
  expect(apply).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
})

it('sorts the full server list even when the name search has no matches', async () => {
  view(); await openOrder()
  fireEvent.change(screen.getByLabelText('Пошук шаблонів'), { target: { value: 'Немає такого' } })
  fireEvent.click(screen.getByRole('button', { name: 'Назви за спаданням' }))
  await waitFor(() => expect(orderReportTemplates).toHaveBeenCalledWith({ Operation: 'sort_name_desc' }, 9, expect.any(Object)))
  expect(screen.getByText(/повного списку, незалежно від пошуку/)).toBeTruthy()
  expect(screen.getByLabelText('Налаштування чернетки').textContent).toBe(JSON.stringify(draft))
})

it('hides order state and disables all template actions immediately when report permission is revoked', async () => {
  const v = view(); await openOrder(); await select('1. Договори')
  v.rerender(<MantineProvider env="test"><I18nProvider><Harness enabled={false} /></I18nProvider></MantineProvider>)
  expect(screen.queryByRole('region', { name: 'Порядок збережених шаблонів' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Порядок шаблонів' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Порядок шаблонів' }))
  expect(orderReportTemplates).not.toHaveBeenCalled()
})
