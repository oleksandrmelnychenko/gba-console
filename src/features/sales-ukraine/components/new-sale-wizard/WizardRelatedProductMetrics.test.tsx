import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { ProductSummaryCard } from './ProductSummaryCard'
import { WizardRelatedProductMetrics } from './WizardRelatedProductMetrics'
import type { WizardSaleProduct } from './wizardSaleProduct'

const product = { NetUid: 'p', VendorCode: 'A1', CurrentPrice: 0.98, CurrentLocalPrice: 0.98, CurrentPriceEurToUah: 50.67 } as WizardSaleProduct
const text = (element: HTMLElement) => element.textContent!.replace(/\s/g, '')

it('badges the converted search price of an EUR agreement as UAH', () => {
  const view = render(<MantineProvider env="test"><I18nProvider>
    <WizardRelatedProductMetrics product={product} isVatSale localCurrencyCode="EUR" />
  </I18nProvider></MantineProvider>)
  expect(text(view.container)).toContain('EUR0,98UAH50,67')
})

it('heads the converted column of the product price table as UAH for an EUR agreement', () => {
  const view = render(<MantineProvider env="test"><I18nProvider>
    <ProductSummaryCard localCurrencyCode="EUR" product={product}
      pricing={{ Pricing: { Name: 'ЦО2' }, PriceEUR: 0.98, DiscountPriceEUR: 0.98, RetailPriceEUR: 1.28, RetailPriceLocal: 66.37 }} />
  </I18nProvider></MantineProvider>)
  const headers = [...view.container.querySelectorAll('thead th')].map(cell => cell.textContent)
  expect(headers.slice(1)).toEqual(['EUR', 'UAH'])
  expect(text(view.container.querySelector('tbody')!)).toContain('Ціна0,9850,67')
  expect(text(view.container.querySelector('tbody')!)).toContain('Роздріб1,2866,37')
})
