import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchCompetitorPrices } from '../api/pricingApi'
import { CompetitorWebSearchPanel } from './CompetitorWebSearchPanel'

vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('../api/pricingApi', () => ({ searchCompetitorPrices: vi.fn() }))

function renderPanel() {
  render(<MantineProvider env="test"><I18nProvider><CompetitorWebSearchPanel product={null} /></I18nProvider></MantineProvider>)
  return screen.getByLabelText<HTMLInputElement>('Пошуковий запит')
}

beforeEach(() => {
  vi.mocked(searchCompetitorPrices).mockReset()
})

it('limits the query to 180 characters and explains a one-character query inline', () => {
  const input = renderPanel()
  expect(input.getAttribute('maxlength')).toBe('180')

  fireEvent.change(input, { target: { value: 'Щ' } })
  expect(screen.getByText('Пошуковий запит має містити від 2 до 180 символів')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Знайти ціни' }) as HTMLButtonElement).disabled).toBe(true)
})

it('maps the server length 400 to the input rule instead of «try later»', async () => {
  vi.mocked(searchCompetitorPrices).mockRejectedValue(
    new ApiError("Competitor query must contain 2-180 characters. (Parameter 'request')", 400, null),
  )
  const input = renderPanel()
  fireEvent.change(input, { target: { value: 'OE-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Знайти ціни' }))

  expect(await screen.findByText('Пошуковий запит має містити від 2 до 180 символів')).toBeTruthy()
  expect(screen.queryByText(/Спробуйте пізніше/)).toBeNull()
})
