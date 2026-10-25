import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WizardClientAgreementsStrip } from './WizardClientAgreementsStrip'
import type { ClientAgreement } from '../../../clients/types'

const calculate = vi.hoisted(() => vi.fn())
vi.mock('./wizardClientStepModel', async importOriginal => {
  const original = await importOriginal<typeof import('./wizardClientStepModel')>()
  return { ...original, getWizardAgreementDebtPresentation: (agreement: ClientAgreement) => {
    calculate(agreement.NetUid)
    return original.getWizardAgreementDebtPresentation(agreement)
  } }
})

it('updates only the two selected agreement cards and still reflects changed debt data', () => {
  const agreements: ClientAgreement[] = Array.from({ length: 30 }, (_, index) => ({
    NetUid: `agreement-${index}`, Agreement: { Name: `Contract ${index}` },
  }))
  const onSelect = vi.fn()
  const view = (selectedKey: string, items = agreements) => <MantineProvider><I18nProvider>
    <WizardClientAgreementsStrip agreements={items} selectedKey={selectedKey} onSelect={onSelect} />
  </I18nProvider></MantineProvider>
  const { rerender } = render(view('agreement-0'))
  calculate.mockClear()
  rerender(view('agreement-1'))
  expect(calculate.mock.calls.flat()).toEqual(['agreement-0', 'agreement-1'])
  fireEvent.click(screen.getByText('Contract 1'))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(agreements[1])
  calculate.mockClear()
  rerender(view('agreement-1', agreements.map((agreement, index) => index === 2 ? { ...agreement, CurrentAmount: 123 } : agreement)))
  expect(calculate).toHaveBeenCalledExactlyOnceWith('agreement-2')
  expect(screen.getByText('123')).toBeTruthy()
})
