import { describe, expect, it } from 'vitest'
import { getAppBottomSheetSnapHeight, resolveAppBottomSheetRelease } from './appBottomSheetModel'

describe('app bottom sheet model', () => {
  it('provides medium and expanded iOS-style detents', () => {
    expect(getAppBottomSheetSnapHeight('medium', 1000)).toBe(600)
    expect(getAppBottomSheetSnapHeight('expanded', 1000)).toBe(900)
  })

  it('closes a medium sheet after a quick downward swipe', () => {
    expect(resolveAppBottomSheetRelease({
      currentHeight: 560,
      startSnap: 'medium',
      velocityY: 0.9,
      viewportHeight: 1000,
    })).toBe('closed')
  })

  it('collapses an expanded sheet before closing it', () => {
    expect(resolveAppBottomSheetRelease({
      currentHeight: 820,
      startSnap: 'expanded',
      velocityY: 0.9,
      viewportHeight: 1000,
    })).toBe('medium')
  })

  it('expands on an upward swipe and otherwise chooses the nearest detent', () => {
    expect(resolveAppBottomSheetRelease({
      currentHeight: 640,
      startSnap: 'medium',
      velocityY: -0.8,
      viewportHeight: 1000,
    })).toBe('expanded')

    expect(resolveAppBottomSheetRelease({
      currentHeight: 780,
      startSnap: 'medium',
      velocityY: 0,
      viewportHeight: 1000,
    })).toBe('expanded')

    expect(resolveAppBottomSheetRelease({
      currentHeight: 680,
      startSnap: 'expanded',
      velocityY: 0,
      viewportHeight: 1000,
    })).toBe('medium')
  })

  it('closes when dragged well below the medium detent', () => {
    expect(resolveAppBottomSheetRelease({
      currentHeight: 400,
      startSnap: 'expanded',
      velocityY: 0,
      viewportHeight: 1000,
    })).toBe('closed')
  })
})
