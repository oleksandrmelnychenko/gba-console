import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { physicalMovementResponse } from './physicalCoverage'
import { PhysicalQuantityCell, PhysicalQuantityExceptionNotice } from './PhysicalQuantityExceptionNotice'
import { physicalQuantityValue, readPhysicalQuantityExceptions } from './physicalQuantityExceptions'
import { unconfirmedBatch as exception } from './physicalQuantityExceptions.test-fixtures'

describe('unconfirmed physical quantity', () => {
  it.each([null, []])('retains the exact exception beside empty Body %j', Body => {
    expect(physicalMovementResponse({ Body, PhysicalQuantityExceptions: [exception] })).toMatchObject({ body: Body, exceptions: [exception] })
  })
  it.each([{ UnclassifiedQuantity: NaN }, { UnclassifiedQuantity: 0 }, { UnclassifiedQuantity: -1 }, { OccurredAtUtc: '2026-10-30T09:00:00' }, { Direction: 'unknown' }, { Reason: 'other' }, { DocumentId: null }])('refuses malformed evidence %j', change => {
    expect(() => readPhysicalQuantityExceptions([{ ...exception, ...change }])).toThrow('непідтвердженої')
  })
  it('keeps zero, null and unconfirmed different without reconstructing a number', () => {
    expect(physicalQuantityValue({}, 0)).toBe(0)
    expect(physicalQuantityValue({}, null)).toBeNull()
    expect(physicalQuantityValue({ QuantityKnown: false }, 999)).toBeNull()
    expect(physicalQuantityValue({ QuantityStatus: 'unconfirmed_batch' }, 999)).toBeNull()
  })
  it('shows a business explanation and exact document even for an after-end exception', () => {
    render(<MantineProvider env="test"><I18nProvider><PhysicalQuantityExceptionNotice exceptions={[exception]} /><PhysicalQuantityCell row={{ QuantityKnown: false, UnclassifiedQuantity: 1 }} value={999} /></I18nProvider></MantineProvider>)
    expect(screen.getByRole('alert').textContent).toContain('ВО-00041 · 30.10.2026 · Розхід: 1')
    expect(document.body.textContent).toContain('—')
    expect(document.body.textContent).not.toMatch(/999|unconfirmed_batch|38423019|2975/)
  })
})
