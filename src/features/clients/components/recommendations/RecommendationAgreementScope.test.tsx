import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { getWizardClientAgreements } from '../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
import type { ClientAgreement } from '../../types'
import { RecommendationAgreementScope } from './RecommendationAgreementScope'

vi.mock('../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi', () => ({
  getWizardClientAgreements: vi.fn(),
}))
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })

const load = vi.mocked(getWizardClientAgreements)
const agreements: ClientAgreement[] = [
  { NetUid: 'agreement-a', Agreement: { Name: 'Договір А', IsActive: true, WithVATAccounting: true } },
  { NetUid: 'agreement-b', Agreement: { Name: 'Договір Б', IsActive: true } },
]

function Selection({ agreement }: { agreement: ClientAgreement }) {
  const [selected, setSelected] = useState(false)
  return <button onClick={() => setSelected(true)}>{agreement.NetUid}:{selected ? 'selected' : 'empty'}</button>
}

function Scope({ client = 'client-a' }: { client?: string }) {
  return (
    <MantineProvider><I18nProvider>
      <RecommendationAgreementScope clientNetId={client}>
        {(agreement) => <Selection agreement={agreement} />}
      </RecommendationAgreementScope>
    </I18nProvider></MantineProvider>
  )
}

describe('recommendation agreement selection', () => {
  beforeEach(() => { load.mockReset() })

  it('resets selected products when switching A to B and back to A', async () => {
    load.mockResolvedValue(agreements)
    render(<Scope />)
    fireEvent.click(await screen.findByText('agreement-a:empty'))
    expect(screen.getByText('agreement-a:selected')).not.toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Договір' }))
    fireEvent.click(await screen.findByRole('option', { hidden: true, name: /Договір Б/ }))
    expect(screen.getByText('agreement-b:empty')).not.toBeNull()
    expect(screen.queryByText('agreement-a:selected')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Договір' }))
    fireEvent.click(await screen.findByRole('option', { hidden: true, name: /Договір А/ }))
    expect(screen.getByText('agreement-a:empty')).not.toBeNull()
  })

  it('does not expose recommendations for inactive or deleted agreements', async () => {
    load.mockResolvedValue([
      { ...agreements[0], Agreement: { IsActive: false } },
      { ...agreements[1], Deleted: true },
    ])
    render(<Scope />)
    await screen.findByText('Для рекомендацій потрібен активний договір клієнта')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignores an old client agreement response after switching clients', async () => {
    let resolveOld!: (rows: ClientAgreement[]) => void
    load.mockImplementation((client) => client === 'client-a'
      ? new Promise((resolve) => { resolveOld = resolve })
      : Promise.resolve([agreements[1]]))
    const view = render(<Scope />)
    view.rerender(<Scope client="client-b" />)
    await screen.findByText('agreement-b:empty')
    await act(async () => { resolveOld([agreements[0]]) })
    await waitFor(() => expect(screen.queryByText('agreement-a:empty')).toBeNull())
    expect(screen.getByText('agreement-b:empty')).not.toBeNull()
  })
})
