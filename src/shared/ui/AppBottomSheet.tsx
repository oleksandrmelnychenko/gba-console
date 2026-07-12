import { Drawer } from '@mantine/core'
import { useDrag, useReducedMotion } from '@mantine/hooks'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import {
  getAppBottomSheetSnapHeight,
  resolveAppBottomSheetRelease,
  type AppBottomSheetSnap,
} from './appBottomSheetModel'
import './app-bottom-sheet.css'

type AppBottomSheetProps = {
  bodyClassName?: string
  children: ReactNode
  closeLabel: string
  collapseLabel: string
  contentClassName?: string
  expandLabel: string
  initialSnap?: AppBottomSheetSnap
  opened: boolean
  overlayOpacity?: number
  title: ReactNode
  onClose: () => void
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ')
}

function getViewportHeight(): number {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

export function AppBottomSheet({
  bodyClassName,
  children,
  closeLabel,
  collapseLabel,
  contentClassName,
  expandLabel,
  initialSnap = 'medium',
  opened,
  overlayOpacity = 0.1,
  title,
  onClose,
}: AppBottomSheetProps) {
  const [snap, setSnap] = useState<AppBottomSheetSnap>(initialSnap)
  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStartHeightRef = useRef(0)
  const dragStartSnapRef = useRef<AppBottomSheetSnap>(initialSnap)
  const lastSignedVelocityYRef = useRef(0)
  const snapRef = useRef<AppBottomSheetSnap>(snap)
  const draggedRef = useRef(false)
  const resetDraggedTimerRef = useRef<number | null>(null)
  const bodyId = useId()
  const reduceMotion = useReducedMotion()

  function getSheetContent(): HTMLElement | null {
    return drawerRef.current?.querySelector<HTMLElement>('.app-bottom-sheet') ?? null
  }

  function applyHeight(height: number) {
    drawerRef.current?.style.setProperty('--drawer-size', `${Math.round(height)}px`)
  }

  function snapTo(nextSnap: AppBottomSheetSnap) {
    snapRef.current = nextSnap
    setSnap(nextSnap)
    applyHeight(getAppBottomSheetSnapHeight(nextSnap, getViewportHeight()))
  }

  function toggleSnap() {
    snapTo(snapRef.current === 'medium' ? 'expanded' : 'medium')
  }

  function scheduleDraggedReset() {
    if (resetDraggedTimerRef.current !== null) {
      window.clearTimeout(resetDraggedTimerRef.current)
    }

    resetDraggedTimerRef.current = window.setTimeout(() => {
      draggedRef.current = false
      resetDraggedTimerRef.current = null
    }, 0)
  }

  const { ref: dragRegionRef } = useDrag<HTMLDivElement>((state) => {
    if (state.tap) {
      return
    }

    const viewportHeight = getViewportHeight()
    const expandedHeight = getAppBottomSheetSnapHeight('expanded', viewportHeight)
    const content = getSheetContent()

    if (state.first) {
      draggedRef.current = true
      dragStartSnapRef.current = snapRef.current
      lastSignedVelocityYRef.current = 0
      dragStartHeightRef.current = content?.getBoundingClientRect().height
        || getAppBottomSheetSnapHeight(snapRef.current, viewportHeight)
      content?.setAttribute('data-dragging', 'true')
    }

    if (state.direction[1] !== 0 && state.velocity[1] > 0) {
      lastSignedVelocityYRef.current = state.direction[1] * state.velocity[1]
    }

    const currentHeight = Math.min(
      expandedHeight,
      Math.max(96, dragStartHeightRef.current - state.movement[1]),
    )

    if (!state.last) {
      applyHeight(currentHeight)
      return
    }

    content?.removeAttribute('data-dragging')

    if (state.canceled) {
      snapTo(dragStartSnapRef.current)
      scheduleDraggedReset()
      return
    }

    const velocityY = state.velocity[1] === 0
      ? 0
      : state.direction[1] !== 0
        ? state.direction[1] * state.velocity[1]
        : lastSignedVelocityYRef.current
    const nextSnap = resolveAppBottomSheetRelease({
      currentHeight,
      startSnap: dragStartSnapRef.current,
      velocityY,
      viewportHeight,
    })

    if (nextSnap === 'closed') {
      onClose()
    } else {
      snapTo(nextSnap)
    }

    scheduleDraggedReset()
  }, {
    axis: 'y',
    filterTaps: true,
    tapThreshold: 4,
    threshold: 3,
  })

  useEffect(() => {
    snapRef.current = snap
  }, [snap])

  useEffect(() => {
    if (!opened) {
      return
    }

    const syncHeight = () => applyHeight(getAppBottomSheetSnapHeight(snapRef.current, getViewportHeight()))
    const frameId = window.requestAnimationFrame(syncHeight)

    window.addEventListener('resize', syncHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', syncHeight)
    }
  }, [opened])

  useEffect(() => () => {
    if (resetDraggedTimerRef.current !== null) {
      window.clearTimeout(resetDraggedTimerRef.current)
    }
  }, [])

  function handleGrabberClick() {
    if (!draggedRef.current) {
      toggleSnap()
    }
  }

  function handleGrabberKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp' && snapRef.current !== 'expanded') {
      event.preventDefault()
      snapTo('expanded')
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (snapRef.current === 'expanded') {
        snapTo('medium')
      } else {
        onClose()
      }
    }
  }

  return (
    <Drawer.Root
      ref={drawerRef}
      opened={opened}
      padding={0}
      position="bottom"
      size={snap === 'expanded' ? '90dvh' : '60dvh'}
      transitionProps={{
        duration: reduceMotion ? 0 : 360,
        timingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      withinPortal
      onClose={onClose}
      onExitTransitionEnd={() => {
        snapRef.current = initialSnap
        setSnap(initialSnap)
        applyHeight(getAppBottomSheetSnapHeight(initialSnap, getViewportHeight()))
      }}
    >
      <Drawer.Overlay backgroundOpacity={overlayOpacity} blur={0} />
      <Drawer.Content
        classNames={{
          content: joinClassNames('app-bottom-sheet', contentClassName),
          inner: 'app-bottom-sheet__inner',
        }}
      >
        <Drawer.Header className="app-bottom-sheet__header">
          <div
            ref={dragRegionRef}
            className="app-bottom-sheet__heading"
            onPointerDownCapture={() => {
              draggedRef.current = false
            }}
          >
            <button
              aria-controls={bodyId}
              aria-label={snap === 'expanded' ? collapseLabel : expandLabel}
              aria-pressed={snap === 'expanded'}
              className="app-bottom-sheet__grabber-button"
              type="button"
              onClick={handleGrabberClick}
              onKeyDown={handleGrabberKeyDown}
            >
              <span className="app-bottom-sheet__grabber" aria-hidden="true" />
            </button>
            <Drawer.Title className="app-bottom-sheet__title">
              <div className="app-bottom-sheet__title-text">{title}</div>
            </Drawer.Title>
          </div>
          <Drawer.CloseButton aria-label={closeLabel} />
        </Drawer.Header>
        <Drawer.Body className={joinClassNames('app-bottom-sheet__body', bodyClassName)}>
          <div id={bodyId}>{children}</div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  )
}
