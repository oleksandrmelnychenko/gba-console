import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { ClientAgreement } from '../../types'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

const sourceAgreement: ClientAgreement = {
  Id: 21,
  NetUid: 'client-agreement-21',
  Agreement: {
    Id: 31,
    NetUid: 'agreement-31',
    Name: '1C agreement',
    SourceAmgCode: 3968,
  },
}

function renderPanel(sourceEditMode: 'locked' | 'manual') {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientAgreementsPanel
          agreements={[sourceAgreement]}
          currencies={[]}
          isProvider={false}
          organizations={[]}
          pricings={[]}
          promotionalPricings={[]}
          sourceEditMode={sourceEditMode}
          onDeleteAgreement={vi.fn()}
          onSaveAgreement={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('source-managed agreement override', () => {
  it('shows the edit action only after manual override is enabled', () => {
    const locked = renderPanel('locked')

    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()

    locked.unmount()
    renderPanel('manual')

    expect(screen.getByRole('button', { name: 'Редагувати' })).not.toBeNull()
  })
})
