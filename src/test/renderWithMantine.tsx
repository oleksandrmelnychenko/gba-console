import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { theme } from '../shared/theme/theme'

export function renderWithMantine(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => <MantineProvider theme={theme}>{children}</MantineProvider>,
    ...options,
  })
}
