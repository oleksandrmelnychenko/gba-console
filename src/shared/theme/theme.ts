import { createTheme, Drawer, Modal, type MantineColorsTuple } from '@mantine/core'

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

export const theme = createTheme({
  fontFamily: 'Onest, Inter, system-ui, sans-serif',
  headings: {
    fontFamily: 'Onest, Inter, system-ui, sans-serif',
    fontWeight: '700',
  },
  colors: {
    violet,
  },
  primaryColor: 'violet',
  primaryShade: 8,
  defaultRadius: 'md',
  components: {
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
  },
})
