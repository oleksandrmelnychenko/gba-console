import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  calculateCompanyCarRoadListForCreate,
  getOutcomeOrdersByCompanyCar,
  searchCompanyCarUsers,
} from '../api/companyCarsApi'
import { CompanyCarRoadListFormModal } from './CompanyCarRoadListFormModal'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { Id: 7, LastName: 'Тест', NetUid: 'user-1' } }),
}))

vi.mock('../api/companyCarsApi', () => ({
  calculateCompanyCarRoadListForCreate: vi.fn(),
  calculateCompanyCarRoadListForEdit: vi.fn(),
  createCompanyCarRoadList: vi.fn(),
  getOutcomeOrdersByCompanyCar: vi.fn(),
  searchCompanyCarUsers: vi.fn(),
  updateCompanyCarRoadList: vi.fn(),
}))

describe('CompanyCarRoadListFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOutcomeOrdersByCompanyCar).mockResolvedValue([])
    vi.mocked(searchCompanyCarUsers).mockResolvedValue([])
  })

  it('shows «abc» and negative kilometres as field errors and limits the comment', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <CompanyCarRoadListFormModal
            companyCar={{ LicensePlate: 'AA0001QA', NetUid: 'car-1' }}
            opened
            onClose={() => {}}
            onSaved={() => {}}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.change(await screen.findByLabelText('За містом'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('По місту'), { target: { value: '-5' } })

    expect(await screen.findByText('Введіть число')).toBeTruthy()
    expect(screen.getByText('Значення не може бути від’ємним')).toBeTruthy()
    expect(screen.getByLabelText('Коментар').getAttribute('maxlength')).toBe('150')
    expect(calculateCompanyCarRoadListForCreate).not.toHaveBeenCalled()
  })
})
