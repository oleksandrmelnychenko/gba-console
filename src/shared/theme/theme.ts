import { createTheme, Drawer, Loader, Modal, Tooltip, type MantineColorsTuple } from '@mantine/core'
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

// Brand accent ramp around #E8782E (the «Продажі» orange). primaryColor stays
// violet — `brand` is the named Mantine color for create actions / brand accents,
// mirroring the --brand-orange CSS token in index.css.
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
  primaryColor: 'violet',
  primaryShade: 8,
  defaultRadius: 'md',
  components: {
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
