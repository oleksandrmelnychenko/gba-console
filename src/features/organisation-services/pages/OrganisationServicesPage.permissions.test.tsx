import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganisationServicesPage } from './OrganisationServicesPage'

const mocks = vi.hoisted(() => ({
  getOrganizationPaymentTasks: vi.fn(),
  searchServiceOrganizations: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => false, isLoading: false }),
}))

vi.mock('../api/organisationServicesApi', () => ({
  getOrganizationPaymentTasks: mocks.getOrganizationPaymentTasks,
  searchServiceOrganizations: mocks.searchServiceOrganizations,
}))

describe('OrganisationServicesPage permissions', () => {
  it('does not mount search or payment-task data without page access', () => {
    render(
      <MantineProvider>
        <OrganisationServicesPage />
      </MantineProvider>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(mocks.searchServiceOrganizations).not.toHaveBeenCalled()
    expect(mocks.getOrganizationPaymentTasks).not.toHaveBeenCalled()
  })
})
