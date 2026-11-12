import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { ProcurementCartFreshnessNote } from './ProcurementCartFreshnessNote'

function renderNote(plan: { built_at?: string | null; stale?: boolean }) {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ProcurementCartFreshnessNote plan={plan} />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProcurementCartFreshnessNote', () => {
  it('shows the Kyiv build time of a stale cart', () => {
    renderNote({ built_at: '2026-07-25T06:15:00.123456+00:00', stale: true })

    expect(screen.getByText(/оновлюються/).textContent).toBe('Дані на 09:15, оновлюються')
  })

  it('follows the Kyiv winter offset', () => {
    renderNote({ built_at: '2026-11-12T22:05:00Z', stale: true })

    expect(screen.getByText(/оновлюються/).textContent).toBe('Дані на 00:05, оновлюються')
  })

  it('stays generic when a stale cart has no usable build stamp', () => {
    renderNote({ built_at: null, stale: true })

    expect(screen.getByText(/оновлюються/).textContent).toBe('Дані оновлюються')
  })

  it.each([
    [{ built_at: '2026-07-25T06:15:00Z', stale: false }],
    [{ built_at: '2026-07-25T06:15:00Z' }],
    [{}],
  ])('renders nothing for a current cart %j', (plan) => {
    renderNote(plan)

    expect(screen.queryByText(/оновлюються/)).toBeNull()
  })
})
