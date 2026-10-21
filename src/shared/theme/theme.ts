import { Alert, Autocomplete, Badge, Combobox, createTheme, Drawer, Loader, Modal, MultiSelect, Select, Tooltip, parseThemeColor, type MantineColorsTuple } from '@mantine/core'
import './alerts.css'
import './table-chips.css'
import './static-tables.css'
import './comboboxes.css'
import { IosLoader } from '../ui/IosLoader'

const violet: MantineColorsTuple = [
  '#F5F3FF',
  '#EDE9FE',
  '#DDD6FE',
  '#C4B5FD',
  '#A78BFA',
  '#8B5CF6',
  '#7C3AED',
  '#6D28D9',
  '#5B21B6',
  '#4C1D95',
]

// Brand accent ramp around #E8782E (the «Продажі» orange) — the theme primary,
// so every Button/ActionIcon without an explicit color renders in brand orange.
// Mirrors the --brand-orange CSS token in index.css.
const brand: MantineColorsTuple = [
  '#FFF4EB',
  '#FCE3D1',
  '#F8C5A1',
  '#F3A66E',
  '#EF8C45',
  '#EC7E2F',
  '#E8782E',
  '#CB6526',
  '#A4501D',
  '#7C3C13',
]

const comboboxStyles = {
  dropdown: { minWidth: 'max(320px, var(--popover-anchor-width, 0px))' },
}

export const theme = createTheme({
  fontFamily: 'Onest, Inter, system-ui, sans-serif',
  headings: {
    fontFamily: 'Onest, Inter, system-ui, sans-serif',
    fontWeight: '700',
  },
  colors: {
    violet,
    brand,
  },
  primaryColor: 'brand',
  primaryShade: 6,
  defaultRadius: 'md',
  components: {
    Combobox: Combobox.extend({
      defaultProps: { position: 'bottom-start' },
      styles: comboboxStyles,
    }),
    Select: Select.extend({ styles: comboboxStyles }),
    MultiSelect: MultiSelect.extend({ styles: comboboxStyles }),
    Autocomplete: Autocomplete.extend({ styles: comboboxStyles }),
    Badge: Badge.extend({
      styles: (theme, props) => {
        // Keep the badge's semantic colour even when its caller uses a filled
        // variant. These tokens are applied inside tables, expanded rows and work sheets.
        const color = parseThemeColor({ color: props.color ?? 'gray', theme })
        const palette = color.isThemeColor ? theme.colors[color.color] : undefined
        const chipTones: Record<string, string> = {
          gray: 'neutral', dark: 'neutral', blue: 'document', cyan: 'source',
          teal: 'storage', green: 'success', yellow: 'warning', orange: 'warning',
          brand: 'warning', red: 'danger', violet: 'product',
        }
        const chipTone = color.isThemeColor ? chipTones[color.color] : undefined
        return {
          root: {
            '--table-chip-bg': chipTone ? `var(--app-chip-${chipTone}-bg)` : palette?.[0] ?? `color-mix(in srgb, ${color.value} 8%, white)`,
            '--table-chip-border': chipTone ? `var(--app-chip-${chipTone}-border)` : palette?.[3] ?? `color-mix(in srgb, ${color.value} 30%, white)`,
            '--table-chip-text': chipTone ? `var(--app-chip-${chipTone}-text)` : palette?.[9] ?? `color-mix(in srgb, ${color.value} 65%, black)`,
          },
        }
      },
    }),
    Alert: Alert.extend({
      classNames: { root: 'app-alert' },
    }),
    Loader: Loader.extend({
      defaultProps: {
        loaders: { ...Loader.defaultLoaders, ios: IosLoader },
        type: 'ios',
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        overlayProps: {
          backgroundOpacity: 0.25,
          blur: 2,
        },
        transitionProps: {
          transition: 'pop',
          duration: 240,
          timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        overlayProps: {
          backgroundOpacity: 0.25,
          blur: 2,
        },
      },
    }),
    Tooltip: Tooltip.extend({
      styles: {
        tooltip: {
          backgroundColor: '#fff',
          border: '1px solid #000',
          color: '#000',
        },
        arrow: {
          backgroundColor: '#fff',
        },
      },
    }),
  },
})
