import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchDatasetReportValues } from '../api/reportsApi'
import type { ReportSelection } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), searchDatasetReportValues: vi.fn() }))

const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
  FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [] }
const provider = (children: ReactNode) => <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
const picker = () => provider(<SelectionValuePicker dataSource={38} lookupProfitReadMode={0} selection={selection}
  selections={[selection]} from="2026-09-01" to="2026-09-30" label="Значення" onChange={vi.fn()} />)

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

it('tells a failed value lookup apart from an empty answer', async () => {
  vi.mocked(searchDatasetReportValues).mockRejectedValue(new ApiError('Сервер недоступний. Спробуйте ще раз пізніше.', 0, null))
  render(picker())
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  expect(await screen.findByText('Не вдалося завантажити значення. Змініть пошук, щоб спробувати ще раз.')).toBeTruthy()
  expect(screen.queryByText('Нічого не знайдено')).toBeNull()
})

it('keeps the empty-answer message when the lookup succeeds without values', async () => {
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  render(picker())
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  expect(await screen.findByText('Нічого не знайдено')).toBeTruthy()
  expect(screen.queryByText(/Не вдалося завантажити значення/)).toBeNull()
})

it('retries with the next search and drops the failure once values arrive', async () => {
  vi.mocked(searchDatasetReportValues).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([{ Id: '9007199254740993', Name: 'BENEFIT OTOMOTIV' }])
  render(picker())
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  await screen.findByText('Не вдалося завантажити значення. Змініть пошук, щоб спробувати ще раз.')
  await userEvent.setup().type(input, 'BEN')
  expect(await screen.findByRole('option', { name: 'BENEFIT OTOMOTIV' })).toBeTruthy()
  expect(vi.mocked(searchDatasetReportValues).mock.calls.at(-1)?.[2]).toEqual({ limit: 30, offset: 0, value: 'BEN' })
  expect(screen.queryByText(/Не вдалося завантажити значення/)).toBeNull()
})
