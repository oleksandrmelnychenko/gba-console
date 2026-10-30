import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiError } from '../../../../shared/api/apiClient'
import { CROSS_SELL_AGREEMENT_UNAVAILABLE } from './crossSellFailure'
import type { RecommendationProduct } from '../../../clients/recommendationsTypes'

const mocks = vi.hoisted(() => ({ load: vi.fn(), t: (text: string) => text }))
vi.mock('../../../clients/api/clientRecommendationsApi', () => ({ getProductCoPurchaseRecommendations: mocks.load }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('../../../../shared/ui/AppModal', () => ({ AppModal: ({ opened, children }: { opened: boolean; children: ReactNode }) => opened ? <div>{children}</div> : null }))
import { WizardCrossSellModal } from './WizardCrossSellModal'

const props = { agreementNetId: 'a', clientNetId: 'c', excludeNetUids: new Set<string>(), isVatSale: false,
  localCurrencyCode: 'UAH', opened: true, seedProduct: { NetUid: 'seed' }, useEurToUah: true, onClose: vi.fn(), onPick: vi.fn() }
const product = { NetUid: 'related', Name: 'Related', CurrentPrice: 12, AvailableQtyUk: 5 }
const ui = (overrides: Partial<typeof props> = {}) => <MantineProvider env="test"><WizardCrossSellModal {...props} {...overrides} /></MantineProvider>
const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0) }) }
function deferred() {
  let resolve!: (items: RecommendationProduct[]) => void
  const promise = new Promise<RecommendationProduct[]>(next => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => { vi.useFakeTimers(); mocks.load.mockReset().mockResolvedValue([product]); props.onPick.mockClear() })
afterEach(() => vi.useRealTimers())

it('reuses a pending read after reopening, but refreshes a completed result on a later opening', async () => {
  const pending = deferred()
  mocks.load.mockReturnValueOnce(pending.promise)
  const view = render(ui())
  await tick()
  const signal = mocks.load.mock.calls[0][3].signal as AbortSignal
  view.rerender(ui({ opened: false }))
  view.rerender(ui())
  await tick()
  expect(signal.aborted).toBe(false)
  expect(mocks.load).toHaveBeenCalledOnce()
  await act(async () => pending.resolve([product]))
  expect(screen.getByText('Related')).toBeTruthy()
  view.rerender(ui({ opened: false }))
  view.rerender(ui())
  expect(screen.queryByText('Related')).toBeNull()
  await tick()
  expect(mocks.load).toHaveBeenCalledTimes(2)
})

it('hides old products immediately when changing the seed and ignores its late response', async () => {
  const pending = deferred()
  const view = render(ui())
  await tick()
  mocks.load.mockReturnValueOnce(pending.promise)
  view.rerender(ui({ seedProduct: { NetUid: 'second' } }))
  expect(screen.queryByText('Related')).toBeNull()
  await tick()
  const signal = mocks.load.mock.calls[1][3].signal as AbortSignal
  view.rerender(ui({ agreementNetId: 'b' }))
  await tick()
  await act(async () => pending.resolve([{ ...product, Name: 'Stale' }]))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByText('Stale')).toBeNull()
})

it('does not request without an agreement and aborts pending reads on unmount while closed', async () => {
  const view = render(ui({ agreementNetId: '' }))
  await tick()
  expect(mocks.load).not.toHaveBeenCalled()
  const pending = deferred()
  mocks.load.mockReturnValueOnce(pending.promise)
  view.rerender(ui())
  await tick()
  const signal = mocks.load.mock.calls[0][3].signal as AbortSignal
  view.rerender(ui({ opened: false }))
  view.unmount()
  expect(signal.aborted).toBe(true)
})

it('keeps cards unchanged when pick callbacks change and still invokes the newest action', async () => {
  const readNumber = vi.fn(() => 'OEM')
  const row = { ...product }
  Object.defineProperty(row, 'MainOriginalNumber', { get: readNumber })
  mocks.load.mockResolvedValue([row])
  const view = render(ui())
  await tick()
  readNumber.mockClear()
  const nextPick = vi.fn()
  view.rerender(ui({ onPick: nextPick }))
  expect(readNumber).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'В кошик' }))
  expect(nextPick).toHaveBeenCalledWith(row)
  expect(props.onPick).not.toHaveBeenCalled()
  view.rerender(ui({ excludeNetUids: new Set(['related']) }))
  expect(screen.queryByText('Related')).toBeNull()
  expect(mocks.load).toHaveBeenCalledOnce()
})

it('retries a failed read on reopening without retaining its error or stale products', async () => {
  mocks.load.mockRejectedValueOnce(new Error('offline'))
  const view = render(ui())
  await tick()
  expect(screen.getByText('Не вдалося завантажити кросс-продажі')).toBeTruthy()
  view.rerender(ui({ opened: false }))
  view.rerender(ui())
  expect(screen.queryByText('Не вдалося завантажити кросс-продажі')).toBeNull()
  await tick()
  expect(screen.getByText('Related')).toBeTruthy()
  expect(mocks.load).toHaveBeenCalledTimes(2)
})

const agreementError = () => new ApiError('upstream message must not be rendered',404,{Body:null,Status:false,StatusCode:404,ErrorCode:'ai_agreement_unavailable'})
it('explains the exact agreement refusal and retries on reopening without switching the agreement',async()=>{
 mocks.load.mockRejectedValueOnce(agreementError());const view=render(ui());await tick()
 expect(screen.getByText(CROSS_SELL_AGREEMENT_UNAVAILABLE)).toBeTruthy();expect(screen.queryByText('Пов’язаних товарів поки немає')).toBeNull();expect(screen.queryByText('upstream message must not be rendered')).toBeNull()
 expect(mocks.load).toHaveBeenLastCalledWith('seed','c',false,expect.objectContaining({clientAgreementNetId:'a'}));expect(props.onPick).not.toHaveBeenCalled()
 view.rerender(ui({opened:false}));view.rerender(ui());expect(screen.queryByText(CROSS_SELL_AGREEMENT_UNAVAILABLE)).toBeNull();await tick();expect(screen.getByText('Related')).toBeTruthy();expect(mocks.load).toHaveBeenLastCalledWith('seed','c',false,expect.objectContaining({clientAgreementNetId:'a'}))
})
it.each([404,503])('does not mislabel untyped HTTP%d as an agreement failure',async status=>{
 mocks.load.mockRejectedValueOnce(new ApiError('not found',status,{Message:'not found'}));render(ui());await tick();expect(screen.getByText('Не вдалося завантажити кросс-продажі')).toBeTruthy();expect(screen.queryByText(CROSS_SELL_AGREEMENT_UNAVAILABLE)).toBeNull()
})
it('retains the successful empty recommendation state independently of agreement refusal',async()=>{
 mocks.load.mockResolvedValueOnce([]);render(ui());await tick();expect(screen.getByText('Пов’язаних товарів поки немає')).toBeTruthy();expect(screen.queryByText(CROSS_SELL_AGREEMENT_UNAVAILABLE)).toBeNull();expect(screen.queryByText('Не вдалося завантажити кросс-продажі')).toBeNull()
})
it.each([{agreementNetId:'next-agreement'},{clientNetId:'next-client'},{seedProduct:{NetUid:'next-seed'}}])('ignores late typed refusal after exact request context changes (%j)',async next=>{
 let reject!:(error:unknown)=>void;const pending=new Promise<RecommendationProduct[]>((_resolve,fail)=>{reject=fail});mocks.load.mockReturnValueOnce(pending);const view=render(ui());await tick();const signal=mocks.load.mock.calls[0][3].signal as AbortSignal
 view.rerender(ui(next));await tick();expect(signal.aborted).toBe(true);expect(screen.getByText('Related')).toBeTruthy();await act(async()=>reject(agreementError()));expect(screen.queryByText(CROSS_SELL_AGREEMENT_UNAVAILABLE)).toBeNull();expect(screen.getByText('Related')).toBeTruthy()
})
