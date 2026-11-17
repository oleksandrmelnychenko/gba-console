import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_BOOT_INDICATOR_DELAY_MS, SESSION_BOOT_TIMEOUT_MS, SessionBootScreen } from './SessionBootScreen'

describe('SessionBootScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a loader, then «Сервер недоступний» with a retry while the session request hangs', () => {
    const onRetry = vi.fn()
    render(<MantineProvider><SessionBootScreen onRetry={onRetry} /></MantineProvider>)

    expect(screen.queryByText('Завантаження…')).toBeNull()

    act(() => { vi.advanceTimersByTime(SESSION_BOOT_INDICATOR_DELAY_MS) })
    expect(screen.getByText('Завантаження…')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(SESSION_BOOT_TIMEOUT_MS) })
    expect(screen.getByText('Сервер недоступний')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
