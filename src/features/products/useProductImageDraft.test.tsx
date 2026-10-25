import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useProductImageDraft } from './useProductImageDraft'

const original = [{ NetUid: 'first', IsMainImage: true }, { NetUid: 'second' }, { NetUid: 'third' }]
beforeEach(() => {
  let id = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++id}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it('preserves untouched image identities and recognizes a main-image change that was undone', () => {
  const { result } = renderHook(() => useProductImageDraft(original))
  act(() => result.current.makeMain(result.current.images[1]))
  expect(result.current.hasExistingImageChanges).toBe(true)
  expect(result.current.images[2]).toBe(original[2])
  act(() => result.current.makeMain(result.current.images[0]))
  expect(result.current.hasChanges).toBe(false)
  act(() => result.current.removeImage(result.current.images[1]))
  expect(result.current.hasChanges).toBe(true)
  expect(original[1]).not.toHaveProperty('Deleted')
  act(() => result.current.reset())
  expect(result.current.hasChanges).toBe(false)
})

it('reuses retained file previews, revokes removed URLs and cleans up on unmount', () => {
  const first = new File(['a'], 'first.png'), second = new File(['b'], 'second.png')
  const { result, unmount } = renderHook(() => useProductImageDraft(original))
  act(() => result.current.updateSelectedFiles([first]))
  const url = result.current.filePreviews[0].url
  act(() => result.current.updateSelectedFiles([first, second]))
  expect(result.current.filePreviews[0].url).toBe(url)
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  act(() => result.current.updateSelectedFiles([second]))
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url)
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})
