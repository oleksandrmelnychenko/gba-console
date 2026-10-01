import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { readCurrentVparivanieRegional } from '../api/currentVparivanieRegionalApi'
import { currentVparivanieDataset, exactSelection } from '../data/currentVparivanie.test-fixtures'
import { regionalDataset, regionalRequest, regionalResult } from '../data/currentVparivanieRegional.test-fixtures'
import type { CurrentVparivanieRegionalResult } from '../data/currentVparivanieRegional'
import type { ReportDataset, ReportRequestBody } from '../types'
import { CurrentVparivanieRegionalPanel } from './CurrentVparivanieRegionalPanel'

vi.mock('../api/currentVparivanieRegionalApi', () => ({ readCurrentVparivanieRegional: vi.fn() }))
const panel = (request: ReportRequestBody = regionalRequest(), dataset: ReportDataset = regionalDataset, enabled = true) =>
  <MantineProvider env="test"><CurrentVparivanieRegionalPanel dataset={dataset} request={request}
    enabled={enabled} disabled={false} /></MantineProvider>

it('offers the current regional form only with capability and report permission', () => {
  vi.clearAllMocks()
  const view = render(panel(regionalRequest(), currentVparivanieDataset))
  expect(screen.queryByRole('button', { name: 'Показати регіональну форму' })).toBeNull()
  view.rerender(panel(regionalRequest(), regionalDataset, false))
  expect((screen.getByRole('button', { name: 'Показати регіональну форму' }) as HTMLButtonElement).disabled).toBe(true)
  expect(readCurrentVparivanieRegional).not.toHaveBeenCalled()
})

it('uses constructor filters and displays separate total/region columns, then hides old result when a filter changes', async () => {
  vi.clearAllMocks(); vi.mocked(readCurrentVparivanieRegional).mockResolvedValue(regionalResult())
  const request = regionalRequest(); request.selections.push(exactSelection(5, 0, ['10']))
  const view = render(panel(request))
  fireEvent.click(screen.getByRole('button', { name: 'Показати регіональну форму' }))
  await screen.findByText('9007199254740993.00000001')
  expect(readCurrentVparivanieRegional).toHaveBeenCalledWith(regionalDataset, request, expect.any(AbortSignal))
  expect(screen.getByRole('columnheader', { name: 'Контрагенты' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Регіон / RI00100' })).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Завантажити XLSX' }) as HTMLButtonElement).disabled).toBe(false)
  const next = { ...request, selections: [request.selections[0], exactSelection(5, 0, ['11'])] }
  view.rerender(panel(next))
  expect(screen.queryByText('9007199254740993.00000001')).toBeNull()
  expect((screen.getByRole('button', { name: 'Завантажити XLSX' }) as HTMLButtonElement).disabled).toBe(true)
})

it('cancels a pending old-period read and never exposes it under a new period', async () => {
  vi.clearAllMocks()
  let resolve: (value: CurrentVparivanieRegionalResult) => void = () => undefined
  vi.mocked(readCurrentVparivanieRegional).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const request = regionalRequest(), view = render(panel(request))
  fireEvent.click(screen.getByRole('button', { name: 'Показати регіональну форму' }))
  await waitFor(() => expect(readCurrentVparivanieRegional).toHaveBeenCalledOnce())
  const signal = vi.mocked(readCurrentVparivanieRegional).mock.calls[0][2]
  view.rerender(panel({ ...request, to: '2026-10-30' }))
  expect(signal?.aborted).toBe(true)
  resolve(regionalResult())
  await waitFor(() => expect(screen.queryByText('9007199254740993.00000001')).toBeNull())
  expect((screen.getByRole('button', { name: 'Завантажити PDF' }) as HTMLButtonElement).disabled).toBe(true)
})
