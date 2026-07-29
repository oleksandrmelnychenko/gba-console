import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { WizardProductSearchOptions } from './newSaleWizardApi'
import type { WizardSaleProduct } from './wizardSaleProduct'

// ── Mocks: network-facing modules only; rendering stays 100% real ──────────────

const apiMocks = vi.hoisted(() => ({
  getAllProductAvailabilities: vi.fn(async () => ({ TotalAvailabilities: {} })),
  getNearestSupplyOrder: vi.fn(async () => null),
  searchSaleProductsWithAvailability: vi.fn<
    (value: string, clientAgreementNetId: string, options?: WizardProductSearchOptions) => Promise<WizardSaleProduct[]>
  >(async () => []),
}))

vi.mock('./newSaleWizardApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./newSaleWizardApi')>()

  return {
    ...original,
    getAllProductAvailabilities: apiMocks.getAllProductAvailabilities,
    getNearestSupplyOrder: apiMocks.getNearestSupplyOrder,
    getProductAnalogues: vi.fn(async () => []),
    getProductAvailabilityBuckets: vi.fn(async () => []),
    getProductCalculatedPricingsByAgreement: vi.fn(async () => []),
    getProductCurrentPriceByAgreement: vi.fn(async () => null),
    getProductReservationsByAgreement: vi.fn(async () => []),
    searchSaleProductsWithAvailability: apiMocks.searchSaleProductsWithAvailability,
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

vi.mock('./WizardAiPriceHint', () => ({
  WizardAiPriceHint: () => null,
}))

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

beforeEach(() => {
  apiMocks.getAllProductAvailabilities.mockReset().mockResolvedValue({ TotalAvailabilities: {} })
  apiMocks.getNearestSupplyOrder.mockReset().mockResolvedValue(null)
  apiMocks.searchSaleProductsWithAvailability.mockReset().mockResolvedValue([])
  initializeWizardKeyboard(1)
  setWizardKeyboardState('ProductSearch')
})

describe('new-sale wizard performance', () => {
  it('typing in the product search stays within the commit budget', async () => {
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

  it('renders the post-search result set with one active request', async () => {
    const products = Array.from({ length: 20 }, (_unused, index) => ({
      AvailableQtyUk: index + 1,
      NameUA: `Тестовий товар ${index + 1}`,
      NetUid: `product-${index + 1}`,
      VendorCode: `CODE-${index + 1}`,
    })) satisfies WizardSaleProduct[]
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce(products)
    renderProductsStep()

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'sem94' } })

    expect(await screen.findByText('Тестовий товар 20', {}, { timeout: 5_000 })).toBeTruthy()
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledOnce()
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledWith(
      'sem94',
      'agreement-1',
      expect.objectContaining({ limit: 20, offset: 0, signal: expect.any(AbortSignal) }),
    )
  })

  it('aborts an obsolete search and ignores its late result', async () => {
    const first = createDeferred<WizardSaleProduct[]>()
    const second = createDeferred<WizardSaleProduct[]>()
    apiMocks.searchSaleProductsWithAvailability
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderProductsStep()
    const input = screen.getByPlaceholderText(/пошук/i)

    fireEvent.change(input, { target: { value: 'first' } })
    await waitFor(() => expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(1))
    const firstSignal = apiMocks.searchSaleProductsWithAvailability.mock.calls[0]?.[2]?.signal

    fireEvent.change(input, { target: { value: 'second' } })
    await waitFor(() => expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)

    first.resolve([{ NameUA: 'Застарілий товар', NetUid: 'old-product', VendorCode: 'OLD' }])
    second.resolve([{ NameUA: 'Актуальний товар', NetUid: 'new-product', VendorCode: 'NEW' }])

    expect(await screen.findByText('Актуальний товар')).toBeTruthy()
    expect(screen.queryByText('Застарілий товар')).toBeNull()
  })

  it('shows a retryable error instead of an empty-result message', async () => {
    apiMocks.searchSaleProductsWithAvailability
      .mockRejectedValueOnce(new Error('Пошук тимчасово недоступний'))
      .mockResolvedValueOnce([{ NameUA: 'Товар після повтору', NetUid: 'retry-product', VendorCode: 'RETRY' }])
    renderProductsStep()

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'retry' } })

    expect(await screen.findByText('Пошук тимчасово недоступний')).toBeTruthy()
    expect(screen.queryByText('Товарів не знайдено')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))

    expect(await screen.findByText('Товар після повтору')).toBeTruthy()
    expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(2)
  })

  it('does not append a late page from the previous query', async () => {
    const latePage = createDeferred<WizardSaleProduct[]>()
    apiMocks.searchSaleProductsWithAvailability
      .mockResolvedValueOnce([{ NameUA: 'Перший результат', NetUid: 'first-product', VendorCode: 'FIRST' }])
      .mockReturnValueOnce(latePage.promise)
      .mockResolvedValueOnce([{ NameUA: 'Новий результат', NetUid: 'new-product', VendorCode: 'NEW' }])
    renderProductsStep()
    const input = screen.getByPlaceholderText(/пошук/i)

    fireEvent.change(input, { target: { value: 'first' } })
    expect(await screen.findByText('Перший результат')).toBeTruthy()

    fireEvent.click(screen.getByText('Перший результат'))
    await waitFor(() => expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(2))
    const pageSignal = apiMocks.searchSaleProductsWithAvailability.mock.calls[1]?.[2]?.signal

    await act(async () => {
      setWizardKeyboardState('ProductSearch')
    })
    await waitFor(() => expect(input.classList.contains('is-hidden')).toBe(false))
    fireEvent.change(input, { target: { value: 'second' } })

    await waitFor(() => expect(apiMocks.searchSaleProductsWithAvailability).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('Новий результат')).toBeTruthy()
    expect(pageSignal?.aborted).toBe(true)

    latePage.resolve([{ NameUA: 'Сторінка старого запиту', NetUid: 'stale-page', VendorCode: 'STALE' }])
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByText('Сторінка старого запиту')).toBeNull()
  })

  it('loads non-price extended data only when product details are opened', async () => {
    apiMocks.searchSaleProductsWithAvailability.mockResolvedValueOnce([
      { AvailableQtyUk: 4, NameUA: 'Товар з деталями', NetUid: 'detail-product', VendorCode: 'DETAIL' },
    ])
    renderProductsStep()

    fireEvent.change(screen.getByPlaceholderText(/пошук/i), { target: { value: 'detail' } })
    fireEvent.click(await screen.findByText('Товар з деталями'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320))
    })
    expect(apiMocks.getNearestSupplyOrder).not.toHaveBeenCalled()
    expect(apiMocks.getAllProductAvailabilities).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Деталі' }))

    await waitFor(() => expect(apiMocks.getNearestSupplyOrder).toHaveBeenCalledOnce())
    await waitFor(() => expect(apiMocks.getAllProductAvailabilities).toHaveBeenCalledOnce())
  })
})

function renderProductsStep() {
  return render(
    <MantineProvider theme={theme}>
      <Notifications />
      <I18nProvider>
        <NewSaleProductsStep
          agreementNetId="agreement-1"
          client={null}
          clientNetId="client-1"
          sale={null}
          onCartChanged={() => {}}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}
