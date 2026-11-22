import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportCounterpartyRole } from '../data/reportCounterpartyDirectories'
import { ReportCounterpartyDirectory } from './ReportCounterpartyDirectory'

vi.mock('../../../shared/api/apiClient', async importOriginal => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const registry = '/clients/suppliers/registry/manufacturers'
const lookup = '/report/datasets/lookup'
const buyerSearchColumns = 'RegionCode.Value/Client.Name/Client.FullName/Client.USREOU/Client.SourceCode'
const view = (role: ReportCounterpartyRole | null, onClose = vi.fn()) => <MantineProvider env="test">
  <ReportCounterpartyDirectory role={role} onClose={onClose} />
</MantineProvider>

beforeEach(() => api.mockReset())

it('searches all goods registry pages by name and source code without refreshing the registry', async () => {
  api.mockResolvedValueOnce(101)
    .mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ Id: index + 1, Name: `Постачальник ${index + 1}` })))
    .mockResolvedValueOnce([{ Id: 635333, Name: 'ПЛА-ТАН І К ТОВ (MARS+AYFAR)', SourceFenixCode: 8095, SupplierCode: 'GT25' }])
  render(view('goods-supplier'))

  const dialog = screen.getByRole('dialog', { name: 'Постачальник товару' })
  await within(dialog).findByText('Постачальник 1')
  expect(api.mock.calls.map(([path, options]) => [path, options?.query])).toEqual([
    [`${registry}/total`, undefined],
    [`${registry}/filtered`, { value: '', offset: 0, limit: 100 }],
    [`${registry}/filtered`, { value: '', offset: 100, limit: 100 }],
  ])

  const search = within(dialog).getByRole('textbox', { name: 'Код або назва' })
  fireEvent.change(search, { target: { value: '8095' } })
  expect(within(dialog).getByText('GT25 — ПЛА-ТАН І К ТОВ (MARS+AYFAR)')).toBeTruthy()
  fireEvent.change(search, { target: { value: 'пла-тан' } })
  expect(within(dialog).getByText('GT25 — ПЛА-ТАН І К ТОВ (MARS+AYFAR)')).toBeTruthy()
  expect(within(dialog).queryByText('Постачальник 1')).toBeNull()
  expect(api).toHaveBeenCalledTimes(3)
  expect(within(dialog).getByRole('table', { name: 'Контрагенти' })).toBeTruthy()
})

it('cancels a stale buyer request and ignores its result after switching directories', async () => {
  let finishBuyer!: (value: unknown) => void
  api.mockImplementationOnce(() => new Promise(resolve => { finishBuyer = resolve }))
    .mockResolvedValueOnce([{ Id: '32709', Name: 'Fenix 1983 — Перевізник' }])
  const onClose = vi.fn()
  const rendered = render(view('buyer', onClose))
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
  const original = api.mock.calls[0][1]
  expect(api.mock.calls[0][0]).toBe('/clients/registry/all/filtered')
  expect(original?.query).toEqual({ filterSql: buyerSearchColumns, typeRoleFilter: '1', value: '', offset: 0, limit: 31 })

  rendered.rerender(view('service-supplier', onClose))
  const dialog = screen.getByRole('dialog', { name: 'Постачальник послуг' })
  expect(await within(dialog).findByText('Fenix 1983 — Перевізник')).toBeTruthy()
  expect(api).toHaveBeenLastCalledWith(lookup, expect.objectContaining({
    query: { dataSource: 40, field: 17, value: '', offset: 0, limit: 31 },
  }))
  expect(original?.signal?.aborted).toBe(true)
  await act(async () => finishBuyer([{ Id: 633209, Name: 'BLV11201 — Покупець' }]))
  expect(within(dialog).queryByText('BLV11201 — Покупець')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Закрити' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(api.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
})

it('searches buyers by displayed name, normalized region code and source code', async () => {
  api.mockResolvedValueOnce([
    { Id: 632374, Name: 'Покупець з кодом', RegionCode: { Value: 'BKI64901' }, SourceFenixCode: 6591 },
    { Id: 14, Name: 'Покупець з 1С', SourceAmgCode: 314 },
  ]).mockResolvedValueOnce([{ Id: 15, Name: 'Покупець XM', RegionCode: { Value: 'XM0001' } }])
    .mockResolvedValueOnce([{ Id: 632374, Name: 'ТК С.В.С.-2006 ТОВ', RegionCode: { Value: 'BKI64901' } }])
    .mockResolvedValueOnce([{ Id: 16, Name: 'Покупець без коду регіону', RegionCode: null, SourceFenixCode: 6106 }])
  render(view('buyer'))
  expect(await screen.findByText('BKI64901 — Покупець з кодом')).toBeTruthy()
  expect(screen.getByText('AMG 314 — Покупець з 1С')).toBeTruthy()

  const search = screen.getByRole('textbox', { name: 'Код або назва' })
  fireEvent.change(search, { target: { value: ' хм0001 ' } })
  expect(await screen.findByText('XM0001 — Покупець XM')).toBeTruthy()
  expect(api).toHaveBeenLastCalledWith('/clients/registry/all/filtered', expect.objectContaining({
    query: { filterSql: buyerSearchColumns, typeRoleFilter: '1', value: 'XM0001', offset: 0, limit: 31 },
  }))

  fireEvent.change(search, { target: { value: 'ТК С.В.С.-2006' } })
  expect(await screen.findByText('BKI64901 — ТК С.В.С.-2006 ТОВ')).toBeTruthy()
  expect(api).toHaveBeenLastCalledWith('/clients/registry/all/filtered', expect.objectContaining({
    query: { filterSql: buyerSearchColumns, typeRoleFilter: '1', value: 'ТК С.В.С.-2006', offset: 0, limit: 31 },
  }))

  fireEvent.change(search, { target: { value: 'Fenix 6106' } })
  expect(await screen.findByText('Fenix 6106 — Покупець без коду регіону')).toBeTruthy()
  expect(api).toHaveBeenLastCalledWith('/clients/registry/all/filtered', expect.objectContaining({
    query: { filterSql: buyerSearchColumns, typeRoleFilter: '1', value: 'Fenix 6106', offset: 0, limit: 31 },
  }))
})

it('paginates a service directory and resets pagination for a new code query', async () => {
  api.mockResolvedValueOnce(Array.from({ length: 31 }, (_, index) => ({ Id: `${index + 1}`, Name: `Сервіс ${index + 1}` })))
    .mockResolvedValueOnce([{ Id: '31', Name: 'Сервіс 31' }])
    .mockResolvedValueOnce([{ Id: '32487', Name: '31316718 — ТзОВ Нова Пошта' }])
  render(view('service-supplier'))

  const first = await screen.findByRole('button', { name: 'Далі' })
  expect(screen.queryByText('Сервіс 31')).toBeNull()
  fireEvent.click(first)
  expect(await screen.findByText('Сервіс 31')).toBeTruthy()
  expect(api.mock.calls[1][1]?.query).toMatchObject({ offset: 30, limit: 31 })
  fireEvent.change(screen.getByRole('textbox', { name: 'Код або назва' }), { target: { value: '31316718' } })
  expect(await screen.findByText('31316718 — ТзОВ Нова Пошта')).toBeTruthy()
  expect(api.mock.calls[2][1]?.query).toMatchObject({ value: '31316718', offset: 0, limit: 31 })
})
