import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../shared/api/apiClient'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { theme } from '../../shared/theme/theme'
import { createOrganizationClient, toAgreementDatePayload, updateOrganizationClient } from './api/organizationClientsApi'
import { OrganizationClientAgreementsPanel } from './components/OrganizationClientAgreementsPanel'

vi.mock('../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('organization client agreement «Дата»', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('is sent as the picked calendar day at noon, so the server keeps that day', () => {
    expect(toAgreementDatePayload('2026-11-17')).toBe('2026-11-17T12:00:00')
    // A re-save of the stored value does not move it.
    expect(toAgreementDatePayload('2026-11-17T00:00:00')).toBe('2026-11-17T12:00:00')
    expect(toAgreementDatePayload(new Date(2026, 10, 17, 0, 0))).toBe('2026-11-17T12:00:00')
  })

  it('create and edit both normalize every agreement date', async () => {
    apiRequestMock.mockResolvedValue({})
    const client = { FullName: 'Acme', OrganizationClientAgreements: [{ FromDate: '2026-11-17' }, { FromDate: '2026-11-16T00:00:00' }] }

    await createOrganizationClient(client)
    await updateOrganizationClient(client)

    for (const call of apiRequestMock.mock.calls) {
      const body = call[1]?.body as typeof client
      expect(body.OrganizationClientAgreements.map((agreement) => agreement.FromDate)).toEqual([
        '2026-11-17T12:00:00',
        '2026-11-16T12:00:00',
      ])
    }
  })

  it('a double click on «Додати» adds one agreement', () => {
    const onAdd = vi.fn()
    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <OrganizationClientAgreementsPanel
            agreements={[]}
            currencies={[{ Id: 1, Name: 'Гривня', Code: 'UAH' }]}
            onAddAgreement={onAdd}
            onRemoveAgreement={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Додати договір' }))
    const add = within(screen.getByRole('dialog')).getByRole('button', { name: 'Додати' })
    fireEvent.click(add)
    fireEvent.click(add)

    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
