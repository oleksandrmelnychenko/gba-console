import { Drawer, type DrawerProps } from '@mantine/core'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './app-drawer.css'

export type AppDrawerProps = Omit<DrawerProps, 'title'> & {
  /**
   * Every work window has a visible title in the real drawer header. Keeping
   * it required prevents feature forms from drawing a fake heading inside the
   * body (and leaving the sheet chrome untitled).
   */
  title: ReactNode
  /**
   * Optional action bar pinned to the bottom of the sheet. When provided, the
   * body becomes a scrollable region and the footer always stays in view — the
   * shared pattern for primary sheet actions (Cancel / Save / Delete). Pass a
   * leading node and a trailing group; the footer lays them out space-between.
   */
  footer?: ReactNode
}

/**
 * Standard right-sheet width tiers. Every drawer in the app is snapped to one
 * of these so the sheets are visually consistent regardless of the size value
 * a call site passes.
 */
const SHEET_WIDTHS = {
  compact: 'min(560px, 100vw)',
  standard: 'min(1200px, 100vw)',
  wide: 'min(1240px, 100vw)',
  full: '90vw',
} as const

type SheetTier = keyof typeof SHEET_WIDTHS

type AppDrawerFooterSlotContextValue = {
  register: () => () => void
  target: HTMLDivElement | null
}

const AppDrawerFooterSlotContext = createContext<AppDrawerFooterSlotContextValue | null>(null)

/**
 * Places actions owned by a nested form into the nearest AppDrawer footer.
 * This keeps form state local while the actions remain pinned outside the
 * drawer's scroll region.
 */
export function AppDrawerFooter({ children }: { children: ReactNode }) {
  const slot = useContext(AppDrawerFooterSlotContext)
  const register = slot?.register

  useEffect(() => register?.(), [register])

  return slot?.target ? createPortal(children, slot.target) : null
}

const NAMED_SIZE_TIERS: Record<string, SheetTier> = {
  xs: 'compact',
  sm: 'compact',
  md: 'compact',
  lg: 'standard',
  xl: 'standard',
}

function parseSizeToPx(size: string): number | null {
  const match = size.match(/(\d+(?:\.\d+)?)(px|rem)/)

  if (!match) {
    return null
  }

  const value = parseFloat(match[1])

  return match[2] === 'rem' ? value * 16 : value
}

function snapPxToTier(px: number): SheetTier {
  if (px <= 640) {
    return 'compact'
  }

  if (px <= 1040) {
    return 'standard'
  }

  return 'wide'
}

function resolveSheetWidth(size: DrawerProps['size']): string {
  if (typeof size === 'number') {
    return SHEET_WIDTHS[snapPxToTier(size)]
  }

  if (typeof size === 'string') {
    if (size in SHEET_WIDTHS) {
      return SHEET_WIDTHS[size as SheetTier]
    }

    if (size in NAMED_SIZE_TIERS) {
      return SHEET_WIDTHS[NAMED_SIZE_TIERS[size]]
    }

    // A pure viewport/percentage width or a calc() expression describes a
    // deliberately large work window. Keep min(<px>, <viewport>) values on
    // their px cap so compact legacy sheets do not inflate to the wide tier.
    if (/^calc\(/i.test(size.trim()) || /^\d+(?:\.\d+)?(?:vw|%)$/i.test(size.trim())) {
      return SHEET_WIDTHS.wide
    }

    const px = parseSizeToPx(size)

    if (px !== null) {
      return SHEET_WIDTHS[snapPxToTier(px)]
    }
  }

  return SHEET_WIDTHS.standard
}

/**
 * Shared right-side sheet. Enforces a consistent position, width tier and
 * inner padding across the whole app. Pass size as 'compact' | 'standard' |
 * 'wide' (legacy size values are normalized to the nearest tier).
 */
/* A click aimed at a field while the sheet is still sliding in can land on the
   overlay and instantly close the drawer (for routed sheets it also navigates
   back, dropping the form). Ignore outside clicks for a short window after
   opening so the open animation can settle first. */
const OUTSIDE_CLOSE_ARM_DELAY_MS = 350

export function AppDrawer({
  position = 'right',
  size,
  children,
  className,
  footer,
  ...props
}: AppDrawerProps) {
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null)
  const [registeredFooterCount, setRegisteredFooterCount] = useState(0)
  const registerFooter = useCallback(() => {
    setRegisteredFooterCount((count) => count + 1)

    return () => {
      setRegisteredFooterCount((count) => Math.max(0, count - 1))
    }
  }, [])
  const footerSlot = useMemo(
    () => ({ register: registerFooter, target: footerTarget }),
    [footerTarget, registerFooter],
  )
  const hasFooter = footer != null || registeredFooterCount > 0
  const [outsideCloseArmed, setOutsideCloseArmed] = useState(false)
  const drawerClassName = ['app-drawer', 'app-form-sheet', hasFooter ? 'app-drawer--with-footer' : '', className]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    const timer = setTimeout(
      () => setOutsideCloseArmed(Boolean(props.opened)),
      props.opened ? OUTSIDE_CLOSE_ARM_DELAY_MS : 0,
    )

    return () => clearTimeout(timer)
  }, [props.opened])

  return (
    <Drawer
      {...props}
      className={drawerClassName}
      closeOnClickOutside={(props.closeOnClickOutside ?? true) && outsideCloseArmed}
      padding="lg"
      position={position}
      size={resolveSheetWidth(size)}
      styles={{
        // Floating-sheet chrome applied inline so it always wins over Mantine's
        // own content styles regardless of CSS import order: a small gap on
        // top/right/bottom and rounded corners.
        content: {
          margin: '8px 8px 8px 0',
          height: 'calc(100% - 16px)',
          maxWidth: 'calc(100vw - 8px)',
          borderRadius: 14,
          overflow: 'hidden',
          // Always a flex column so the body owns the available height and can scroll its own
          // content — a tall form/panel would otherwise overflow the fixed-height sheet and clip
          // (e.g. the save button at the bottom of the edit form would be cut off).
          display: 'flex',
          flexDirection: 'column',
        },
        // Tighten the header so the title sits close to the content (no tall
        // fixed header bar and no large bottom gap).
        header: { minHeight: 'auto', paddingBottom: 'var(--mantine-spacing-xs)' },
        // Keep one stable child tree whether a contextual footer is currently
        // visible or not. This preserves local form state when tabs switch
        // between sections that do and do not expose primary actions.
        body: {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          minHeight: 0,
          overflow: 'hidden',
          padding: 0,
        },
      }}
    >
      <AppDrawerFooterSlotContext.Provider value={footerSlot}>
        <div className="app-sheet-body">
          <div className="app-sheet-scroll">{children}</div>
          <div
            ref={setFooterTarget}
            className="app-sheet-footer"
            hidden={!hasFooter}
          >
            {footer}
          </div>
        </div>
      </AppDrawerFooterSlotContext.Provider>
    </Drawer>
  )
}
