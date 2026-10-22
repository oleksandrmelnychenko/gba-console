import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TaskSourceEvidence } from './TaskSourceEvidence'
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (text: string) => text }) }))
const show = (value: unknown) => render(<MantineProvider><TaskSourceEvidence value={value} /></MantineProvider>)
it('deduplicates purchase document evidence and does not imply paid attribution', () => {
  show({ kind: 'purchase', observed_at: '2026-10-22T10:00:00Z', orders: {
    1: { order_id: 123, purchased_at: '2026-10-22T09:00:00Z' },
    2: { order_id: 123, purchased_at: '2026-10-22T09:00:00Z' },
  } })
  expect(screen.getAllByText(/Замовлення #123/)).toHaveLength(1)
  expect(screen.getByText(/це не підтвердження оплати/)).toBeTruthy()
})
it('preserves identified settled debt evidence including zero balance', () => {
  show({ kind: 'debt_settled', debts: { 45: '0.00', 46: '-1.00' } })
  expect(screen.getByText('Борг #45')).toBeTruthy()
  expect(screen.getByText('Борг #46')).toBeTruthy()
})
it('does not render malformed or unknown evidence as a confirmed fact', () => {
  const { container } = show({ kind: 'unknown', orders: {} })
  expect(container.querySelector('p')).toBeNull()
})
