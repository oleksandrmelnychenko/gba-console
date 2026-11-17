import { MantineProvider } from '@mantine/core'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WizardProductPhoto } from './WizardProductPhoto'
import type { WizardSaleProduct } from './wizardSaleProduct'

vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const product = { NetUid: 'p1', VendorCode: 'QA-FLT-002', Name: 'Фільтр' } as WizardSaleProduct

describe('WizardProductPhoto', () => {
  it('requests a missing shop photo only once per session', () => {
    const first = render(<MantineProvider><WizardProductPhoto className="x" hoverPreview={false} product={product} /></MantineProvider>)
    const image = first.container.querySelector('img')
    expect(image?.getAttribute('src')).toContain('qa-flt-002_water.jpg')
    fireEvent.error(image!)
    first.unmount()

    const second = render(<MantineProvider><WizardProductPhoto className="x" hoverPreview={false} product={product} /></MantineProvider>)
    expect(second.container.querySelector('img[src*="qa-flt-002_water.jpg"]')).toBeNull()
  })
})
