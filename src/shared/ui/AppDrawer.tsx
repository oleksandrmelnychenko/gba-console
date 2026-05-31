import { Drawer, type DrawerProps } from '@mantine/core'

/**
 * Standard right-sheet width tiers. Every drawer in the app is snapped to one
 * of these so the sheets are visually consistent regardless of the size value
 * a call site passes.
 */
const SHEET_WIDTHS = {
  compact: 'min(560px, 100vw)',
  standard: 'min(900px, 100vw)',
  wide: 'min(1240px, 100vw)',
} as const

type SheetTier = keyof typeof SHEET_WIDTHS

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

    const px = parseSizeToPx(size)

    if (px !== null) {
      return SHEET_WIDTHS[snapPxToTier(px)]
    }

    // Anything viewport/percentage/calc based is treated as a wide sheet.
    if (/vw|%|calc/i.test(size)) {
      return SHEET_WIDTHS.wide
    }
  }

  return SHEET_WIDTHS.standard
}

/**
 * Shared right-side sheet. Enforces a consistent position, width tier and
 * inner padding across the whole app. Pass size as 'compact' | 'standard' |
 * 'wide' (legacy size values are normalized to the nearest tier).
 */
export function AppDrawer({ position = 'right', size, children, ...props }: DrawerProps) {
  return (
    <Drawer
      {...props}
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
        },
        // Tighten the header so the title sits close to the content (no tall
        // fixed header bar and no large bottom gap).
        header: { minHeight: 'auto', paddingBottom: 'var(--mantine-spacing-xs)' },
        // Uniform breathing room on the sides/bottom, with a small top gap so
        // content sits just under the title rather than far below it.
        body: { padding: 'var(--mantine-spacing-lg)', paddingTop: 'var(--mantine-spacing-xs)' },
      }}
    >
      {children}
    </Drawer>
  )
}
