import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'

let granted = false
let loading = false

vi.mock('../usePermissions', () => ({
  usePermissions: () => ({
    can: () => granted,
    isLoading: loading,
  }),
}))

import { PagePermissionBoundary } from './PagePermissionBoundary'

const DataPage = vi.fn(() => <div>Сторінка з даними</div>)

function renderBoundary() {
  return render(
    <MantineProvider><I18nProvider>
      <PagePermissionBoundary
        permissionKey={PermissionKeys.SystemPages.Dashboard.View}
      >
        <DataPage />
      </PagePermissionBoundary>
    </I18nProvider></MantineProvider>,
  )
}

describe('PagePermissionBoundary', () => {
  beforeEach(() => {
    granted = false
    loading = false
    DataPage.mockClear()
  })

  it('does not mount the page while permissions are loading', () => {
    loading = true

    renderBoundary()

    expect(screen.getByLabelText('Завантаження прав доступу')).toBeTruthy()
    expect(DataPage).not.toHaveBeenCalled()
  })

  it('does not mount the page when access is denied', () => {
    renderBoundary()

    expect(screen.getByRole('alert').textContent).toContain('Доступ заборонено')
    expect(screen.getByRole('alert').textContent).toContain('Ця сторінка недоступна для вашого облікового запису.')
    expect(screen.queryByText('Сторінка з даними')).toBeNull()
    expect(DataPage).not.toHaveBeenCalled()
  })

  it('mounts the page only after access is granted', () => {
    granted = true

    renderBoundary()

    expect(screen.getByText('Сторінка з даними')).toBeTruthy()
    expect(DataPage).toHaveBeenCalledOnce()
  })
})
