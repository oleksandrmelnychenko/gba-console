export type MergedServiceExchangeRatePresentation = {
  description: string
  labelSuffix: string
}

export function getMergedServiceExchangeRatePresentation(
  currencyCode: string | null | undefined,
  translate: (value: string) => string,
): MergedServiceExchangeRatePresentation {
  const normalizedCurrencyCode = currencyCode?.trim().toUpperCase() || ''

  if (normalizedCurrencyCode === 'UAH') {
    return {
      description: translate(
        'Договір у гривні: автоматичний курс дорівнює 1. Залиште поле порожнім; введене значення буде ручним курсом.',
      ),
      labelSuffix: ' (UAH = 1)',
    }
  }

  return {
    description: translate(
      'Необов’язково. Залиште порожнім — система застосує офіційний курс на дату митної декларації, а якщо її немає — на дату створення сервісу. Введене значення буде ручним курсом.',
    ),
    labelSuffix: normalizedCurrencyCode ? ` (${normalizedCurrencyCode} → UAH)` : '',
  }
}
