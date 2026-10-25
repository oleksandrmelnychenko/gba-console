import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ProductFullDetailPanel } from './ProductFullDetailPanel'
import { WizardProductDetailsPanel } from './WizardProductDetailsPanel'

const mocks = vi.hoisted(() => ({ t: (label: string) => label }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('./ProductFullDetailPanel', () => ({ ProductFullDetailPanel: vi.fn(() => null) }))
const latest = () => vi.mocked(ProductFullDetailPanel).mock.calls.at(-1)![0]
const props = (): ComponentProps<typeof WizardProductDetailsPanel> => ({
  canEditDescription: true, descriptionDraft: '', isEditingDescription: false, isVatSale: false,
  pricing: null, product: { NetUid: 'product-a', AvailableQtyUk: 8, AvailableQtyUkReSale: 2 },
  snapshot: { availabilities: { InStorageUkrNotVat: [{ Amount: 3 }], AvailableQtyUkReSale: [{ Amount: 4 }] },
    detailsLoaded: true, detailsError: null, nearestOrder: null },
  selectedChipIndex: 2, selectedRowIndex: null, onDescriptionDraftChange: vi.fn(), onToggleDescription: vi.fn(),
})
beforeEach(() => { vi.clearAllMocks(); mocks.t = label => label })

describe('shared product detail panel', () => {
  it('reuses computed rows and chips when keyboard selection or a description draft changes', () => {
    const input = props()
    const view = render(<WizardProductDetailsPanel {...input} />)
    const initial = latest()
    expect(initial.displayQty).toBe(7)
    view.rerender(<WizardProductDetailsPanel {...input} selectedRowIndex={0} descriptionDraft="new draft" />)
    expect(latest().rows).toBe(initial.rows)
    expect(latest().chips).toBe(initial.chips)
    expect(latest()).toMatchObject({ selectedRowIndex: 0, descriptionDraft: 'new draft' })
    view.rerender(<WizardProductDetailsPanel {...input} selectedChipIndex={3} />)
    expect(latest().chips).toBe(initial.chips)
    expect(latest().rows[0].amount).toBe(4)
  })

  it('rebuilds stock data on refresh and translates labels again on language changes', () => {
    const input = props()
    const view = render(<WizardProductDetailsPanel {...input} />)
    const initial = latest()
    view.rerender(<WizardProductDetailsPanel {...input} snapshot={{ ...input.snapshot!, availabilities: { InStorageUkrNotVat: [{ Amount: 0 }] } }} />)
    expect(latest().rows).not.toBe(initial.rows)
    expect(latest().chips[2].count).toBe(0)
    expect(latest().displayQty).toBe(0)
    mocks.t = label => `translated:${label}`
    view.rerender(<WizardProductDetailsPanel {...input} />)
    expect(latest().chips[0].name).toBe('translated:В рахунках')
  })

  it('preserves loading, retry, price overrides and account row details', () => {
    const input = props(), onRetryDetails = vi.fn()
    const view = render(<WizardProductDetailsPanel {...input} selectedChipIndex={0} currentPriceEur={0} onRetryDetails={onRetryDetails} snapshot={null} />)
    expect(latest()).toMatchObject({ isLoadingDetails: true, showRowDetails: true, currentPriceEur: 0, displayQty: 10, rows: [] })
    expect(latest().onRetryDetails).toBe(onRetryDetails)
    view.rerender(<WizardProductDetailsPanel {...input} snapshot={{ ...input.snapshot!, detailsError: 'Retry required' }} />)
    expect(latest()).toMatchObject({ isLoadingDetails: false, detailsError: 'Retry required', showRowDetails: false })
  })

  it('drops previous details when switching to a product without a snapshot and uses VAT stock only', () => {
    const input = props(), view = render(<WizardProductDetailsPanel {...input} />)
    view.rerender(<WizardProductDetailsPanel {...input} isVatSale product={{ NetUid: 'product-b', AvailableQtyUkVAT: 6, AvailableQtyUkReSale: 40 }} snapshot={null} />)
    expect(latest()).toMatchObject({ rows: [], displayQty: 6, isLoadingDetails: true, product: { NetUid: 'product-b' } })
    expect(latest().chips.every(chip => chip.count === 0)).toBe(true)
  })
})
