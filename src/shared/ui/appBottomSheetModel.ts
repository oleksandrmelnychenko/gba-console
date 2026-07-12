export type AppBottomSheetSnap = 'medium' | 'expanded'

const MEDIUM_HEIGHT_RATIO = 0.6
const EXPANDED_HEIGHT_RATIO = 0.9
const MIN_MEDIUM_HEIGHT = 280
const TOP_GAP = 12
const CLOSE_HEIGHT_RATIO = 0.72
const SWIPE_VELOCITY_THRESHOLD = 0.65

export function getAppBottomSheetSnapHeight(snap: AppBottomSheetSnap, viewportHeight: number): number {
  const safeViewportHeight = Math.max(0, viewportHeight)
  const availableHeight = Math.max(0, safeViewportHeight - TOP_GAP)
  const mediumHeight = Math.min(
    availableHeight,
    Math.max(MIN_MEDIUM_HEIGHT, safeViewportHeight * MEDIUM_HEIGHT_RATIO),
  )

  if (snap === 'medium') {
    return mediumHeight
  }

  return Math.max(mediumHeight, Math.min(availableHeight, safeViewportHeight * EXPANDED_HEIGHT_RATIO))
}

export function resolveAppBottomSheetRelease({
  currentHeight,
  startSnap,
  velocityY,
  viewportHeight,
}: {
  currentHeight: number
  startSnap: AppBottomSheetSnap
  velocityY: number
  viewportHeight: number
}): AppBottomSheetSnap | 'closed' {
  const mediumHeight = getAppBottomSheetSnapHeight('medium', viewportHeight)
  const expandedHeight = getAppBottomSheetSnapHeight('expanded', viewportHeight)

  if (currentHeight < mediumHeight * CLOSE_HEIGHT_RATIO) {
    return 'closed'
  }

  if (velocityY >= SWIPE_VELOCITY_THRESHOLD) {
    return startSnap === 'expanded' && currentHeight > mediumHeight * CLOSE_HEIGHT_RATIO
      ? 'medium'
      : 'closed'
  }

  if (velocityY <= -SWIPE_VELOCITY_THRESHOLD) {
    return 'expanded'
  }

  return currentHeight >= (mediumHeight + expandedHeight) / 2 ? 'expanded' : 'medium'
}
