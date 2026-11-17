import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { ManagerSalesChart } from './ManagerSalesChart'
import { productTopColumnLabel } from './salesChartLabels'

vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('sales by managers chart labels', () => {
  it('names the column of products without a Top category instead of leaving a blank header', () => {
    expect(productTopColumnLabel('', 'Без категорії')).toBe('Без категорії')
    expect(productTopColumnLabel('X', 'Без категорії')).toBe('X')
  })

  it('explains that only the selected Top group had no sales', () => {
    render(
      <MantineProvider theme={theme}>
        <ManagerSalesChart
          data={[{ manager: 'Петренко Іван', total: 0 }]}
          detailCount={0}
          detailLabel="Товарів у звіті"
          emptyTitle="За цей період немає продажів товарів Top N"
          isLoading={false}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('За цей період немає продажів товарів Top N')).toBeTruthy()
    expect(screen.queryByText('За цей період продажів немає')).toBeNull()
  })
})
