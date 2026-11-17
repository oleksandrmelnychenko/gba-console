import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getSalesByProductTop } from '../api/salesChartsApi'
import { ManagerSalesByTopNXView } from './ManagerSalesByTopNXView'

const stableT = (key: string) => key
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: stableT }) }))
vi.mock('../api/salesChartsApi', () => ({ getSalesByProductTop: vi.fn() }))

describe('Top N-X view', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
  })

  it('starts with all products and shows only managers who sold in the period', async () => {
    vi.mocked(getSalesByProductTop).mockResolvedValue({
      Managers: [
        { ManagerName: 'sales QA', NetId: 'm1', TotalManagerSold: 167.5, TypeOrder: 1 },
        { ManagerName: 'storekeeper QA', NetId: 'm2', TotalManagerSold: 0, TypeOrder: 1 },
      ],
      Products: [{ ManagersSoldProduct: { m1: 167.5 }, ProductNetId: 'p1', VendorCode: 'QA-FLT-001' }],
    } as never)

    render(<MantineProvider theme={theme}><ManagerSalesByTopNXView /></MantineProvider>)

    await waitFor(() => expect(getSalesByProductTop).toHaveBeenCalledWith(expect.objectContaining({ typeTop: 2 })))
    expect((await screen.findAllByText('sales QA')).length).toBeGreaterThan(0)
    expect(screen.queryByText('storekeeper QA')).toBeNull()
  })
})
