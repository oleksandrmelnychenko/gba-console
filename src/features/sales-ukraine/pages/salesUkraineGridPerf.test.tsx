import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'

// ── Mocks: network-facing modules only; rendering stays 100% real ──────────────

const SALES_COUNT = 30

function buildFakeSale(index: number): SalesUkraineSale {
  return {
    Id: index + 1,
    NetUid: `sale-${index + 1}`,
    IsVatSale: index % 3 === 0,
    TotalAmount: 100 + index,
    TotalAmountLocal: 4200 + index,
    Created: new Date(2026, 5, 1 + (index % 28), 10, 30).toISOString(),
    SaleNumber: { Value: `КИЛ0000${1000 + index}` },
    BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
    ClientAgreement: {
      Client: {
        FullName: `Тест клієнт ${index + 1}`,
        RegionCode: { Value: `k${String(index).padStart(5, '0')}` },
      },
      Agreement: { Name: `Договір ${index + 1}`, Currency: { Code: 'EUR' } },
    },
    Order: {
      TotalVat: 21,
      OrderItems: [
        { Id: index * 10 + 1, NetUid: `oi-${index}-1`, Qty: 2, TotalAmount: 50 },
        { Id: index * 10 + 2, NetUid: `oi-${index}-2`, Qty: 1, TotalAmount: 50 },
      ],
    },
    User: { FirstName: 'Олег', LastName: 'Менеджер' },
  } as unknown as SalesUkraineSale
}

const getSalesUkraine = vi.fn(async () => Array.from({ length: SALES_COUNT }, (_, index) => buildFakeSale(index)))

vi.mock('../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/salesUkraineApi')>()

  return {
    ...original,
    getSalesUkraine: (...args: unknown[]) => getSalesUkraine(...(args as [])),
    getSalesUkraineOrganizations: vi.fn(async () => []),
    getSaleById: vi.fn(async () => null),
  }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { FirstName: 'Test', LastName: 'User', NetUid: 'user-1' },
  }),
}))

vi.mock('../../../shared/realtime/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../shared/realtime/events')>()

  return {
    ...original,
    useRealtimeEvent: () => {},
  }
})

import { SalesUkrainePage } from './SalesUkrainePage'

// ── Profiler-based render benchmark ─────────────────────────────────────────────
// Regression guard for the sales-registry hot path: renders the page with 30
// sales, types QUERY into the search box, and counts React commits + fetches.
// Before optimization every keystroke fired an un-debounced un-aborted fetch and
// swapped the whole grid to a skeleton (unmount/remount of all rows); rows were
// not memoized, so any state change re-rendered all of them.

const QUERY = 'motor9'

describe('sales grid performance', () => {
  // Generous timeout: under the fully parallel suite the jsdom mount alone can
  // take >1s; the budgets below are commit/fetch counts, never durations.
  it('typing in the search stays within commit and fetch budgets', { timeout: 20_000 }, async () => {
    let commits = 0
    let totalDuration = 0
    const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
      commits += 1
      totalDuration += actualDuration
    }

    render(
      <MantineProvider theme={theme}>
        <Notifications />
        <I18nProvider>
          <MemoryRouter>
            <Profiler id="sales-grid" onRender={onRender}>
              <SalesUkrainePage />
            </Profiler>
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(screen.getAllByText(/Тест клієнт/).length).toBeGreaterThan(0)
    })

    const mountCommits = commits
    const mountDuration = totalDuration
    const mountFetches = getSalesUkraine.mock.calls.length

    commits = 0
    totalDuration = 0

    const input = screen.getByPlaceholderText(/Товар або номер продажу/)
    const started = performance.now()

    for (let index = 1; index <= QUERY.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        fireEvent.change(input, { target: { value: QUERY.slice(0, index) } })
      })
    }

    const typingCommits = commits
    const typingDuration = totalDuration
    const wallMs = performance.now() - started

    // At least one follow-up fetch lands after typing (tolerant so the metrics
    // line below always prints — the strict budgets follow it).
    await waitFor(() => {
      expect(getSalesUkraine.mock.calls.length).toBeGreaterThanOrEqual(mountFetches + 1)
    }, { timeout: 2000 })

    // Give any stragglers a beat so the printed fetch count is final.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })

    const totalFetches = getSalesUkraine.mock.calls.length
    const nodeProcess = (globalThis as { process?: { stdout?: { write?: (chunk: string) => void } } }).process

    nodeProcess?.stdout?.write?.(
      `\n[sales-grid-perf] mount(${SALES_COUNT} rows): ${mountCommits} commits / ${mountDuration.toFixed(1)}ms · ` +
        `typing ${QUERY.length} chars: ${typingCommits} commits / ${typingDuration.toFixed(1)}ms profiler / ${wallMs.toFixed(1)}ms wall · ` +
        `${(typingDuration / QUERY.length).toFixed(2)}ms per keystroke · fetches after typing: ${totalFetches - mountFetches}\n`,
    )

    expect(typingCommits).toBeGreaterThan(0)
    // The debounced commit triggers exactly ONE follow-up fetch — NOT one per
    // keystroke.
    expect(totalFetches).toBe(mountFetches + 1)
    // One commit per keystroke plus the debounced-commit render — NOT a
    // skeleton swap re-mounting all rows.
    expect(typingCommits).toBeLessThanOrEqual(QUERY.length * 2 + 2)
  })
})
