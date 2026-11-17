import { describe, expect, it } from 'vitest'
import source from './WizardSaleHeader.tsx?raw'

describe('wizard header sale number', () => {
  it('is printed as stored (no uppercase transform: «QAUНо…» must not become «QAUНО…»)', () => {
    const numberElement = source.slice(source.indexOf('data-testid="wizard-sale-number"'), source.indexOf('{sale.SaleNumber?.Value ?? \'\'}'))

    expect(numberElement).not.toBe('')
    expect(numberElement).not.toMatch(/uppercase/i)
  })
})
