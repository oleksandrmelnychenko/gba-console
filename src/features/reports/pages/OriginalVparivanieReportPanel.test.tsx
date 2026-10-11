import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalMatrixCapability, getOriginalMatrixScopeBinding, readScopedOriginalMatrix } from '../api/originalVparivanieApi'
import { originalMatrixXlsx } from '../data/originalVparivanieExport'
import { originalScopeBinding, originalScopeRequest, scopedMatrixFixture } from '../testing/originalVparivanieScopeFixtures'
import { matrixCapability } from '../testing/originalVparivanieFixtures'
import { OriginalVparivanieReportPanel } from './OriginalVparivanieReportPanel'

vi.mock('../api/originalVparivanieApi', () => ({ getOriginalMatrixCapability: vi.fn(), getOriginalMatrixScopeBinding: vi.fn(), readScopedOriginalMatrix: vi.fn() }))
vi.mock('../data/originalVparivanieExport', async original => ({ ...await original<typeof import('../data/originalVparivanieExport')>(), originalMatrixXlsx: vi.fn() }))
const view = (request = originalScopeRequest(), enabled = true) => <MantineProvider env="test"><I18nProvider>
  <OriginalVparivanieReportPanel request={request} enabled={enabled} disabled={false} callerKey="user" />
</I18nProvider></MantineProvider>
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getOriginalMatrixCapability).mockResolvedValue(matrixCapability())
  vi.mocked(getOriginalMatrixScopeBinding).mockResolvedValue(originalScopeBinding())
  vi.mocked(readScopedOriginalMatrix).mockResolvedValue(scopedMatrixFixture())
})
it('reads one accepted full saved scope and exposes exact zero/null cells and Excel export', async () => {
  render(view()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  await screen.findByRole('table')
  expect(getOriginalMatrixScopeBinding).toHaveBeenCalledWith(matrixCapability(),
    { World: 'fenix', From: '2025-01-01', Through: '2026-10-09', GroupId: 3569 }, expect.any(AbortSignal))
  expect(readScopedOriginalMatrix).toHaveBeenCalledWith(originalScopeBinding(), expect.any(AbortSignal))
  expect(screen.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '', '', '', '', '-9007199254740993.125', '-9007199254740993.125'])
  expect((screen.getByRole('button', { name: 'Оригінальна матриця Excel' }) as HTMLButtonElement).disabled).toBe(false)
})
it('refuses missing admission before any history preview', async () => {
  vi.mocked(getOriginalMatrixScopeBinding).mockResolvedValue({ ...originalScopeBinding(), AcceptanceProofSha256: null, AcceptedInputWitnessSha256: null })
  render(view()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  await screen.findByText(/цієї групи та періоду ще проходить/)
  expect(readScopedOriginalMatrix).not.toHaveBeenCalled(); expect(screen.queryByRole('table')).toBeNull()
})
it('does not call any endpoint without report generation permission', () => {
  render(view(originalScopeRequest(), false)); fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  expect(getOriginalMatrixCapability).not.toHaveBeenCalled()
})
it('clears a late previous-period result and aborts its owner when settings change', async () => {
  let resolve!: (value: ReturnType<typeof scopedMatrixFixture>) => void
  vi.mocked(readScopedOriginalMatrix).mockReturnValue(new Promise(done => { resolve = done }))
  const rendered = render(view()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  await waitFor(() => expect(readScopedOriginalMatrix).toHaveBeenCalledOnce())
  const signal = vi.mocked(readScopedOriginalMatrix).mock.calls[0][1]!
  rendered.rerender(view({ ...originalScopeRequest(), to: '2026-10-08' }))
  resolve(scopedMatrixFixture()); await waitFor(() => expect(signal.aborted).toBe(true))
  expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'Оригінальна матриця Excel' }) as HTMLButtonElement).disabled).toBe(true)
})
it('refuses stale asynchronous Excel download after permission is revoked', async () => {
  let resolve!: (value: Blob) => void
  vi.mocked(originalMatrixXlsx).mockReturnValue(new Promise(done => { resolve = done }))
  const create = vi.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  const rendered = render(view()); fireEvent.click(screen.getByRole('button', { name: 'Переглянути оригінальну матрицю' }))
  await screen.findByRole('table'); fireEvent.click(screen.getByRole('button', { name: 'Оригінальна матриця Excel' }))
  await waitFor(() => expect(originalMatrixXlsx).toHaveBeenCalledOnce())
  rendered.rerender(view(originalScopeRequest(), false)); resolve(new Blob(['test']))
  await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
  expect(create).not.toHaveBeenCalled()
})
