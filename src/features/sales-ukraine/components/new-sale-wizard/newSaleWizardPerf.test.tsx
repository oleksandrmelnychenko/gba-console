import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'

// ── Mocks: network-facing modules only; rendering stays 100% real ──────────────

vi.mock('./newSaleWizardApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./newSaleWizardApi')>()

  return {
    ...original,
    getAllProductAvailabilities: vi.fn(async () => ({ Rows: [], Total: 0 })),
    getNearestSupplyOrder: vi.fn(async () => null),
    getProductAnalogues: vi.fn(async () => []),
    getProductAvailabilityBuckets: vi.fn(async () => []),
    getProductCalculatedPricingsByAgreement: vi.fn(async () => []),
    getProductCurrentPriceByAgreement: vi.fn(async () => null),
    getProductReservationsByAgreement: vi.fn(async () => []),
    searchSaleProductsWithAvailability: vi.fn(async () => []),
    shiftOrderItemFromSale: vi.fn(async () => null),
  }
})

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...original,
    addOrderItem: vi.fn(async () => null),
    deleteOrderItem: vi.fn(async () => null),
    updateOrderItem: vi.fn(async () => null),
  }
})

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { FirstName: 'Test', LastName: 'User', NetUid: 'user-1' },
  }),
}))

vi.mock('../../../../shared/realtime/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/realtime/events')>()

  return {
    ...original,
    useRealtimeEvent: () => {},
  }
})

import { NewSaleProductsStep } from './NewSaleProductsStep'
import { initializeWizardKeyboard, setWizardKeyboardState } from './wizardKeyboard'

// ── Profiler-based render benchmark ─────────────────────────────────────────────
// Regression guard for the wizard keystroke hot path: types QUERY into the
// product search box and counts React commits + actualDuration across the step
// tree. Before optimization a keystroke re-rendered the entire 2600-line step
// (~1 commit per char over the full tree). The numbers are logged so before/after
// runs are comparable; the assertion only pins the commit count so real
// regressions (extra commits per keystroke) fail loudly.

const QUERY = '900252-AL-BENCH'

describe('new-sale wizard performance', () => {
  it('typing in the product search stays within the commit budget', async () => {
    initializeWizardKeyboard(1)
    setWizardKeyboardState('ProductSearch')

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
          <Profiler id="products-step" onRender={onRender}>
            <NewSaleProductsStep
              agreementNetId="agreement-1"
              client={null}
              clientNetId="client-1"
              sale={null}
              onCartChanged={() => {}}
            />
          </Profiler>
        </I18nProvider>
      </MantineProvider>,
    )

    const input = screen.getByPlaceholderText(/пошук/i)

    const mountCommits = commits
    const mountDuration = totalDuration
    commits = 0
    totalDuration = 0

    const started = performance.now()

    for (let index = 1; index <= QUERY.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        fireEvent.change(input, { target: { value: QUERY.slice(0, index) } })
      })
    }

    const wallMs = performance.now() - started

    // process.stdout bypasses vitest's console interception so the numbers are
    // always visible in the run output. (Typed via globalThis — the app tsconfig
    // has no node types.)
    const nodeProcess = (globalThis as { process?: { stdout?: { write?: (chunk: string) => void } } }).process

    nodeProcess?.stdout?.write?.(
      `\n[wizard-perf] mount: ${mountCommits} commits / ${mountDuration.toFixed(1)}ms · ` +
        `typing ${QUERY.length} chars: ${commits} commits / ${totalDuration.toFixed(1)}ms profiler / ${wallMs.toFixed(1)}ms wall · ` +
        `${(totalDuration / QUERY.length).toFixed(2)}ms per keystroke\n`,
    )

    expect(commits).toBeGreaterThan(0)
    // Commit budget: baseline is ~2.1 commits per keystroke (input state +
    // search-status updates). If a change makes keystrokes commit extra times
    // (or re-mounts subtrees), this fails. The logged per-keystroke duration is
    // the primary optimization metric (baseline: ~27ms/char in jsdom).
    expect(commits).toBeLessThanOrEqual(QUERY.length * 3)
  })
})
