import { MantineProvider, PasswordInput } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('theme PasswordInput default', () => {
  it('labels the visibility toggle in Ukrainian', () => {
    render(
      <MantineProvider theme={theme}>
        <PasswordInput label="Пароль" visibilityToggleFocusable />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: 'Показати або приховати пароль' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Toggle password visibility' })).toBeNull()
  })

  it('keeps a caller-specific label', () => {
    render(
      <MantineProvider theme={theme}>
        <PasswordInput label="Пароль" visibilityToggleFocusable visibilityToggleButtonProps={{ 'aria-label': 'Показати пароль' }} />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: 'Показати пароль' })).toBeTruthy()
  })
})
