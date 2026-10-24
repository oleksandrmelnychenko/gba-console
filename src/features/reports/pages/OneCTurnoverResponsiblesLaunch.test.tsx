import actualCatalogue from '../data/oneCTurnoverCatalogue.http-fixture.json'
import type { ReportCatalogue } from '../types'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOneCTurnoverScopes } from '../api/reportsApi'
import { organizationOnlyScope, turnoverCatalogue } from '../data/oneCTurnoverScopes.test-fixtures'
import { OneCTurnoverResponsiblesLaunch } from './OneCTurnoverResponsiblesLaunch'
import type { OneCTurnoverScopeSummary } from '../types'
vi.mock('../api/reportsApi', () => ({ getOneCTurnoverScopes: vi.fn() }))
describe('v3 catalogue launch gates', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getOneCTurnoverScopes).mockResolvedValue([organizationOnlyScope]) })
  it('accepts the actual DEV source manifest without borrowing its older scope claims', async () => {
    const onOpen = vi.fn()
    render(<MantineProvider env="test"><OneCTurnoverResponsiblesLaunch catalogue={actualCatalogue as unknown as ReportCatalogue} canGenerate disabled={false} callerKey="u1" onOpen={onOpen} /></MantineProvider>)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Продажі за відповідальними' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за відповідальними' }))
    expect(onOpen.mock.calls[0][0].Filters).toEqual(organizationOnlyScope.Filters)
    expect(screen.queryByText(/собівартість/i)).toBeNull()
  })

  it('requires actual publication before opening exactscope and retries an initially empty catalogue', async () => {
    vi.mocked(getOneCTurnoverScopes).mockResolvedValueOnce([])
    const onOpen = vi.fn()
    render(<MantineProvider env="test"><OneCTurnoverResponsiblesLaunch catalogue={turnoverCatalogue} canGenerate disabled={false} callerKey="u1" onOpen={onOpen} /></MantineProvider>)
    await screen.findByText(/ще не опубліковано/)
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними' })).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити покриття продажів' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Продажі за відповідальними' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за відповідальними' }))
    expect(onOpen).toHaveBeenCalledWith(organizationOnlyScope, turnoverCatalogue)
  })
  it.each(['permission', 'world', 'source', 'dataset', 'evidence'] as const)('does not query or offer launch without %s', reason => {
    const catalogue = structuredClone(turnoverCatalogue)
    const source = catalogue.Reports[0].Sources[0]
    if (reason === 'world') source.World = 'amg'
    if (reason === 'source') source.SourceId = 'wrong'
    if (reason === 'dataset') source.Migration!.NativeDataSources = [35]
    if (reason === 'evidence') delete catalogue.Migration
    render(<MantineProvider env="test"><OneCTurnoverResponsiblesLaunch catalogue={catalogue} canGenerate={reason !== 'permission'} disabled={false} callerKey="u1" onOpen={vi.fn()} /></MantineProvider>)
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними' })).toBeNull()
  })
  it('ignores a previous caller publication response', async () => {
    let complete!: (value: OneCTurnoverScopeSummary[]) => void
    vi.mocked(getOneCTurnoverScopes).mockReturnValueOnce(new Promise(resolve => { complete = resolve })).mockResolvedValueOnce([])
    const element = (callerKey: string) => <MantineProvider env="test"><OneCTurnoverResponsiblesLaunch catalogue={turnoverCatalogue} canGenerate disabled={false} callerKey={callerKey} onOpen={vi.fn()} /></MantineProvider>
    const { rerender } = render(element('u1'))
    rerender(element('u2'))
    await screen.findByText(/ще не опубліковано/)
    await act(async () => { complete([organizationOnlyScope]) })
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними' })).toBeNull()
  })
})
