import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import type { AuthContextValue } from '../auth/types'
import { ApiError } from '../../shared/api/apiClient'
import { saveSession } from '../../shared/auth/session'
import { SourceRegisterReportsPage } from './SourceRegisterReportsPage'
import type { SourceRegisterReportBuilderProps } from './SourceRegisterReportBuilder'
import type { SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import catalogueText from './fixtures/runtime-catalogue.json?raw'
import schemaText from './fixtures/runtime-schema.json?raw'
import queryText from './fixtures/runtime-query.json?raw'
import statementText from './fixtures/runtime-statement.json?raw'

const api = vi.hoisted(() => ({ list: vi.fn(), schema: vi.fn(), generate: vi.fn() }))
vi.mock('./registerReportsApi', () => ({ listRegisterPublications: api.list, getRegisterSchema: api.schema, generateRegisterStatement: api.generate }))
// Lifecycle controls only; the separate real-provider test exercises the full production builder and raw API.
vi.mock('./SourceRegisterReportBuilder', () => ({ SourceRegisterReportBuilder: (props: SourceRegisterReportBuilderProps) => <div>
  <input aria-label="Контроль дати" value={props.value.from.date} onChange={event => props.onChange({ ...props.value, from: { ...props.value.from, date: event.target.value } })} />
  <button disabled={props.busy} onClick={() => props.onSubmit(JSON.parse(queryText) as SourceRegisterQueryWire)}>Сформувати контрольний звіт</button>
</div> }))
const original = JSON.parse(catalogueText).items[0]
const publications = [{ ...original, caption: 'Публікація А' }, { ...original, publicationId: '33333333-3333-3333-3333-333333333333', caption: 'Публікація Б' }]
const session = { userNetUid: '11111111-1111-1111-1111-111111111111', csrfToken: 'test-page-csrf' }
const result = JSON.parse(statementText) as SourceRegisterResultWire
function auth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { session, user: { NetUid: session.userNetUid }, isAuthenticated: true, isLoading: false, isPermissionsLoading: false,
    permissions: [], hasPermission: () => true, login: vi.fn(), logout: vi.fn(), ...overrides }
}
function host(value = auth()) { return <MantineProvider env="test"><MemoryRouter><AuthContext.Provider value={value}><SourceRegisterReportsPage /></AuthContext.Provider></MemoryRouter></MantineProvider> }
async function choose(label = 'Публікація А') {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Публікація даних' }))
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(label) }))
  await screen.findByLabelText('Контроль дати')
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  saveSession(session); api.list.mockReset().mockResolvedValue(publications); api.schema.mockReset().mockResolvedValue(JSON.parse(schemaText)); api.generate.mockReset().mockResolvedValue(result)
})

it('shows no invented choices for an empty catalogue and makes no request without permission', async () => {
  const view = render(host(auth({ hasPermission: () => false })))
  expect(api.list).not.toHaveBeenCalled(); expect(screen.queryByRole('combobox')).toBeNull()
  api.list.mockResolvedValue([]); view.rerender(host())
  expect(await screen.findByText('Дані для звітів регістрів ще не підготовлено.')).toBeTruthy()
  expect(screen.queryByRole('combobox')).toBeNull(); expect(api.schema).not.toHaveBeenCalled()
})

it('clears the authoritative table on a draft edit and before a failed next generation', async () => {
  render(host()); await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('Контроль дати'), { target: { value: '2026-04-02' } })
  expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  api.generate.mockRejectedValueOnce(new ApiError('untrusted raw message', 503, null))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' }))
  expect(screen.queryByRole('table')).toBeNull()
  expect(await screen.findByText('Дані публікації поки недоступні. Спробуйте пізніше або оновіть список.')).toBeTruthy()
  expect(screen.queryByText('untrusted raw message')).toBeNull()
})

it.each([403, 404, 503])('distinguishes the safe %s failure without preserving an earlier table', async status => {
  api.schema.mockRejectedValueOnce(new ApiError('do not display', status, null))
  render(host())
  fireEvent.click(await screen.findByRole('combobox', { name: 'Публікація даних' })); fireEvent.click(await screen.findByRole('option', { name: /Публікація А/ }))
  const expected = status === 403 ? 'Недостатньо прав для формування звітів регістрів.' : status === 404 ? 'Публікація більше недоступна. Оновіть список публікацій.' : 'Дані публікації поки недоступні. Спробуйте пізніше або оновіть список.'
  expect(await screen.findByText(expected)).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull()
})

it('aborts an old publication request and ignores a late completion even if the API ignores cancellation', async () => {
  let complete!: (value: SourceRegisterResultWire) => void
  api.generate.mockReturnValueOnce(new Promise<SourceRegisterResultWire>(resolve => { complete = resolve }))
  render(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' }))
  const signal = api.generate.mock.calls[0][3].signal as AbortSignal
  await choose('Публікація Б'); expect(signal.aborted).toBe(true)
  await act(async () => complete(result)); expect(screen.queryByRole('table')).toBeNull()
})

it('clears data immediately on permission loss, logout and an account switch', async () => {
  const view = render(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  view.rerender(host(auth({ hasPermission: () => false }))); expect(screen.queryByRole('table')).toBeNull()
  view.rerender(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  view.rerender(host(auth({ isAuthenticated: false }))); expect(screen.queryByRole('table')).toBeNull()
  view.rerender(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  const nextSession = { ...session, userNetUid: '22222222-2222-2222-2222-222222222222', csrfToken: 'next-owner' }
  act(() => saveSession(nextSession)); expect(screen.queryByRole('table')).toBeNull()
  view.rerender(host(auth({ session: nextSession, user: { NetUid: nextSession.userNetUid } })))
  await screen.findByRole('combobox', { name: 'Публікація даних' }); expect(screen.queryByRole('table')).toBeNull()
})

it('invalidates rendered data on a cross-tab logout even before AuthProvider context updates', async () => {
  render(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  act(() => { localStorage.removeItem('gba_console_session'); window.dispatchEvent(new StorageEvent('storage', { key: 'gba_console_session' })) })
  expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByRole('combobox')).toBeNull()
})

it('refreshing the catalogue removes its selected publication and requests a fresh list', async () => {
  render(host()); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати контрольний звіт' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'Оновити публікації' })); expect(screen.queryByRole('table')).toBeNull()
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2)); expect(screen.queryByLabelText('Контроль дати')).toBeNull()
})
