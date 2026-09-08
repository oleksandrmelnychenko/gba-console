import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { readSession, saveSession } from '../../shared/auth/session'
import { SourceRegisterReportsPage } from './SourceRegisterReportsPage'
import * as registerApi from './registerReportsApi'
import type { SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import catalogueText from './fixtures/runtime-catalogue.json?raw'
import schemaText from './fixtures/runtime-schema.json?raw'
import statementText from './fixtures/runtime-statement.json?raw'

const session = { userNetUid: '11111111-1111-1111-1111-111111111111', csrfToken: 'test-before-refresh' }
vi.mock('../auth/api/authApi', () => ({
  getServerSession: vi.fn(async () => session), getCurrentUserProfile: vi.fn(async () => ({ NetUid: session.userNetUid })), signIn: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../auth/api/permissionsApi', () => ({ getMyPermissions: vi.fn(async () => ({ permissionKeys: [PermissionKeys.ReportsStocks.Report.Generate, PermissionKeys.ReportsStocks.Page.View] })) }))
const fetchMock = vi.fn()
const json = (text: string, status = 200) => new Response(text, { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(async () => { HTMLElement.prototype.scrollIntoView = vi.fn(); saveSession(session); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('crypto', (await vi.importActual<{ webcrypto: Crypto }>('node:crypto')).webcrypto) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

it('real AuthProvider token rotation preserves the actual builder draft and completes its retried exact statement', async () => {
  const frozen = JSON.parse(statementText) as SourceRegisterResultWire
  const index = new Map(frozen.query.selections.map((selection, position) => [`${selection.resourceUuid}:${selection.stage}`, position]))
  const submitted: string[] = []
  const failures: unknown[] = []
  const generate = registerApi.generateRegisterStatement
  const generationSpy = vi.spyOn(registerApi, 'generateRegisterStatement').mockImplementation(async (...args) => {
    try { return await generate(...args) } catch (error) { failures.push(error); throw error }
  })
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    if (url.endsWith('/generalized/publications')) return Promise.resolve(json(catalogueText))
    if (url.endsWith('/schema')) return Promise.resolve(json(schemaText))
    if (url.endsWith('/usermanagement/token/refresh')) return Promise.resolve(json(JSON.stringify({ Body: { UserNetUid: session.userNetUid, CsrfToken: 'test-after-refresh' } })))
    if (url.endsWith('/statement')) {
      submitted.push(init.body as string)
      if (submitted.length === 1) return Promise.resolve(json('{}', 401))
      const query = JSON.parse(init.body as string) as SourceRegisterQueryWire
      expect(query.from).toBe(frozen.query.from); expect(query.toExclusive).toBe(frozen.query.toExclusive)
      expect(query.rowFields).toEqual(frozen.query.rowFields); expect(query.columnFields).toEqual(frozen.query.columnFields)
      // Test-only column permutation of frozen server numbers, with no arithmetic or invented totals.
      const positions = query.selections.map(selection => index.get(`${selection.resourceUuid}:${selection.stage}`)!)
      expect(new Set(positions).size).toBe(10)
      return Promise.resolve(json(JSON.stringify({ ...frozen, query, groups: frozen.groups.map(group => ({ ...group, values: positions.map(position => group.values[position]) })), grandValues: positions.map(position => frozen.grandValues[position]) })))
    }
    throw new Error(`Unexpected test route: ${new URL(url).pathname}`)
  })
  render(<MantineProvider env="test"><MemoryRouter initialEntries={['/reports/registers']}><AuthProvider><SourceRegisterReportsPage /></AuthProvider></MemoryRouter></MantineProvider>)
  fireEvent.click(await screen.findByRole('combobox', { name: 'Публікація даних' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic runtime fixture/ }))
  await screen.findByRole('form', { name: 'Конструктор регістрового звіту' })
  fireEvent.change(screen.getByLabelText('Від (включно): дата'), { target: { value: '2026-04-02' } })
  fireEvent.change(screen.getByLabelText('До (не включно): дата'), { target: { value: '2026-04-03' } })
  fireEvent.change(screen.getByLabelText('Від (включно): частки секунди'), { target: { value: '0000001' } })
  fireEvent.change(screen.getByLabelText('До (не включно): частки секунди'), { target: { value: '0000002' } })
  fireEvent.click(screen.getByRole('combobox', { name: 'Додати вимір: рядки' })); fireEvent.click(await screen.findByRole('option', { name: 'Договір' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати до рядків' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Додати вимір: колонки' })); fireEvent.click(await screen.findByRole('option', { name: 'Одиниця' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати до колонок' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати всі ресурси та стадії' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати звіт' }))
  await waitFor(() => expect({ submitted, alert: screen.queryByRole('alert')?.textContent }).toMatchObject({ submitted: [expect.any(String), expect.any(String)] }))
  await waitFor(() => { if (failures.length) throw failures[0]; expect(screen.queryByRole('table')).not.toBeNull() })
  expect(submitted).toHaveLength(2); expect(submitted[0]).toBe(submitted[1])
  expect(readSession()?.csrfToken).toBe('test-after-refresh')
  expect((screen.getByLabelText('Від (включно): дата') as HTMLInputElement).value).toBe('2026-04-02')
  expect((screen.getByLabelText('До (не включно): частки секунди') as HTMLInputElement).value).toBe('0000002')
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/schema'))).toHaveLength(1)
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/generalized/publications'))).toHaveLength(1)
  generationSpy.mockRestore()
}, 15000)
