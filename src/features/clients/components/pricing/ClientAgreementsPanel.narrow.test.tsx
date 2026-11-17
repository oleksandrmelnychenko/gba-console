import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { ClientAgreement } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'

vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

const agreement: ClientAgreement = {
  Id: 1,
  NetUid: 'client-agreement-1',
  Agreement: { Id: 2, NetUid: 'agreement-2', Name: 'QA Договір', IsActive: true, Currency: { Id: 1, Name: 'Євро' } },
}

function renderPanel(onExportAgreementWarrantyConditions = vi.fn()) {
  render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientAgreementsPanel
          agreements={[agreement]}
          currencies={[]}
          isProvider={false}
          organizations={[]}
          pricings={[]}
          promotionalPricings={[]}
          sourceEditMode="manual"
          onDeleteAgreement={vi.fn()}
          onExportAgreementDocument={vi.fn()}
          onExportAgreementWarrantyConditions={onExportAgreementWarrantyConditions}
          onSaveAgreement={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('agreement rows', () => {
  it('titles the warranty export «Друк гарантійних умов»', async () => {
    const onWarranty = vi.fn()
    renderPanel(onWarranty)
    fireEvent.click(screen.getByRole('button', { name: 'Гарантійні умови' }))

    expect(onWarranty).toHaveBeenCalledWith('agreement-2')
    expect(await screen.findByText('Друк гарантійних умов')).toBeTruthy()
  })

  it('stacks the row at phone width instead of truncating name, status and currency', () => {
    renderPanel()
    expect(document.querySelector('.agreement-item__layout .agreement-item__info .agreement-item__name')?.textContent).toBe('QA Договір')
    expect(document.querySelector('.agreement-item__layout .agreement-item__actions')).not.toBeNull()

    const css = readFileSync('src/features/clients/components/pricing/client-agreements.css', 'utf8') as string
    const narrow = css.slice(css.indexOf('@media (max-width: 600px)'))
    expect(narrow).toContain('.agreement-item__layout.mantine-Group-root')
    expect(narrow).toMatch(/\.agreement-item__name\.mantine-Text-root \{[^}]*white-space: normal/)
  })
})
