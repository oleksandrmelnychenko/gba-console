import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { ClientEditActions } from './ClientEditPage'

function renderActions(canEdit: boolean) {
  return render(
    <MantineProvider env="test" theme={theme}>
      <I18nProvider>
        <ClientEditActions
          canDelete
          canEdit={canEdit}
          client={{ NetUid: 'client-1' }}
          isDeleting={false}
          isSaving={false}
          sourceManaged={false}
          sourceOverrideEnabled={false}
          onDelete={vi.fn()}
          onEnableSourceOverride={vi.fn()}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ClientEditPage permissions', () => {
  it('keeps delete independent but hides aggregate save without client.edit', () => {
    renderActions(false)

    expect(screen.getByRole('button', { name: 'Видалити' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
  })

  it('renders aggregate save only with client.edit', () => {
    renderActions(true)

    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy()
  })
})
