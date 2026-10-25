import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { updateProduct } from '../../../products/api/productsApi'
import { useWizardProductDescription } from './useWizardProductDescription'

vi.mock('../../../products/api/productsApi', () => ({ updateProduct: vi.fn() }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (text: string) => text }) }))
const save = vi.mocked(updateProduct)
const product = { NetUid: 'a', Description: 'original' }
function deferred() {
  let resolve!: (value: null) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<null>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const callbacks = { onSaved: vi.fn(), onBegin: vi.fn(), onFinish: vi.fn() }
  return { ...callbacks, ...renderHook((props) => useWizardProductDescription({ ...callbacks, ...props }), {
    initialProps: { product, source: 'main' },
  }) }
}
beforeEach(() => { save.mockReset().mockResolvedValue(null) })

it('keeps failed drafts editable and deduplicates saves until the request settles', async () => {
  const first = deferred()
  save.mockReturnValueOnce(first.promise)
  const { result, onSaved, onFinish } = setup()
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('draft'))
  let pending!: Promise<void>
  act(() => { pending = result.current.toggle(); void result.current.toggle() })
  expect(save).toHaveBeenCalledOnce()
  expect(result.current.isEditing).toBe(true)
  expect(result.current.isSaving).toBe(true)
  expect(onSaved).not.toHaveBeenCalled()
  await act(async () => { first.reject(new Error('offline')); await pending })
  expect(result.current.isEditing).toBe(true)
  expect(result.current.isSaving).toBe(false)
  expect(result.current.error).toBe('offline')
  expect(result.current.draft).toBe('draft')
  expect(onFinish).not.toHaveBeenCalled()
  await act(() => result.current.toggle())
  expect(save).toHaveBeenCalledTimes(2)
  expect(save).toHaveBeenLastCalledWith({ ...product, Description: 'draft' }, true)
  expect(onSaved).toHaveBeenCalledExactlyOnceWith({ ...product, Description: 'draft' })
  expect(result.current.isEditing).toBe(false)
  expect(onFinish).toHaveBeenCalledOnce()
})

it('does not write unchanged drafts or rerender the step on each keystroke', async () => {
  const { result, onFinish } = setup()
  await act(() => result.current.toggle())
  const beforeTyping = result.current
  act(() => result.current.changeDraft('original'))
  expect(result.current).toBe(beforeTyping)
  await act(() => result.current.toggle())
  expect(save).not.toHaveBeenCalled()
  expect(onFinish).toHaveBeenCalledOnce()
})

it('finishes the original write without closing a different product editor', async () => {
  const first = deferred()
  save.mockReturnValueOnce(first.promise)
  const { result, rerender, onSaved, onFinish } = setup()
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('saved A'))
  let pending!: Promise<void>
  act(() => { pending = result.current.toggle() })
  rerender({ product: { NetUid: 'b', Description: 'B' }, source: 'component' })
  expect(result.current.isSaving).toBe(false)
  expect(result.current.isEditing).toBe(false)
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('draft B'))
  await act(async () => { first.resolve(null); await pending })
  expect(onSaved).toHaveBeenCalledExactlyOnceWith({ ...product, Description: 'saved A' })
  expect(onFinish).not.toHaveBeenCalled()
  expect(result.current.isEditing).toBe(true)
  await act(() => result.current.toggle())
  expect(save).toHaveBeenLastCalledWith({ NetUid: 'b', Description: 'draft B' }, false)
})

it('ignores retired errors across A-B-A and prevents a second write for pending A', async () => {
  const first = deferred()
  save.mockReturnValueOnce(first.promise)
  const { result, rerender, onFinish } = setup()
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('old draft'))
  let pending!: Promise<void>
  act(() => { pending = result.current.toggle() })
  rerender({ product: { NetUid: 'b', Description: 'B' }, source: 'main' })
  rerender({ product, source: 'main' })
  await act(() => result.current.toggle())
  expect(result.current.isEditing).toBe(false)
  expect(result.current.isSaving).toBe(true)
  await act(async () => { first.reject(new Error('old error')); await pending })
  expect(result.current.error).toBeNull()
  expect(onFinish).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledOnce()
  await act(() => result.current.toggle())
  expect(result.current.draft).toBe('original')
})

it('does not restore keyboard state after the drawer closes or publish after unmount', async () => {
  const first = deferred()
  save.mockReturnValueOnce(first.promise)
  const { result, onSaved, onFinish, unmount } = setup()
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('saved'))
  let pending!: Promise<void>
  act(() => { pending = result.current.toggle(); result.current.reset() })
  await act(async () => { first.resolve(null); await pending })
  expect(onSaved).toHaveBeenCalledOnce()
  expect(onFinish).not.toHaveBeenCalled()
  const second = deferred()
  save.mockReturnValueOnce(second.promise)
  await act(() => result.current.toggle())
  act(() => result.current.changeDraft('after unmount'))
  act(() => { pending = result.current.toggle() })
  unmount()
  await act(async () => { second.resolve(null); await pending })
  expect(onSaved).toHaveBeenCalledOnce()
})
