import { describe, expect, it } from 'vitest'
import { getMergedServiceExchangeRatePresentation } from './mergedServiceExchangeRatePresentation'

const t = (value: string) => value

describe('merged-service exchange-rate presentation', () => {
  it('makes the automatic UAH rate explicit', () => {
    expect(getMergedServiceExchangeRatePresentation('uah', t)).toEqual({
      description: 'Договір у гривні: автоматичний курс дорівнює 1. Залиште поле порожнім; введене значення буде ручним курсом.',
      labelSuffix: ' (UAH = 1)',
    })
  })

  it('shows the conversion direction for a foreign-currency agreement', () => {
    const presentation = getMergedServiceExchangeRatePresentation(' eur ', t)

    expect(presentation.labelSuffix).toBe(' (EUR → UAH)')
    expect(presentation.description).toContain('офіційний курс на дату митної декларації')
  })

  it('keeps the generic explanation until an agreement is selected', () => {
    const presentation = getMergedServiceExchangeRatePresentation(undefined, t)

    expect(presentation.labelSuffix).toBe('')
    expect(presentation.description).toContain('Введене значення буде ручним курсом')
  })
})
