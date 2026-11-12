import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../../shared/api/apiClient'
import { getWizardClientAgreements } from '../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
import { RecommendationAgreementScope } from './RecommendationAgreementScope'
import { useRecommendationsData } from './useRecommendationsData'

vi.mock('../../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi', () => ({
  getWizardClientAgreements: vi.fn(),
}))

const request = vi.mocked(apiRequest)
const loadAgreements = vi.mocked(getWizardClientAgreements)

function Recommendations({ agreementNetId }: { agreementNetId: string }) {
  const { state } = useRecommendationsData({ agreementNetId, clientNetId: 'client-a' })

  return <p>{state.isLoading ? 'loading' : `loaded:${state.products.length}`}</p>
}

beforeEach(() => {
  request.mockReset()
  loadAgreements.mockReset()
})

it('requests recommendations for the pre-selected agreement on first open, without re-picking it', async () => {
  loadAgreements.mockResolvedValue([
    { NetUid: 'agreement-a', Agreement: { Name: 'Договір А', IsActive: true } },
    { NetUid: 'agreement-b', Agreement: { Name: 'Договір Б', IsActive: true } },
  ])
  request.mockReturnValue(new Promise(() => undefined))

  render(
    <MantineProvider><I18nProvider>
      <RecommendationAgreementScope clientNetId="client-a">
        {(agreement) => <Recommendations agreementNetId={agreement.NetUid || ''} />}
      </RecommendationAgreementScope>
    </I18nProvider></MantineProvider>,
  )

  await waitFor(() => expect(request).toHaveBeenCalledOnce())
  expect(request.mock.calls[0][0]).toBe('/recommendations/get')
  expect(request.mock.calls[0][1]?.query).toMatchObject({ clientNetId: 'client-a', clientAgreementNetId: 'agreement-a' })
  expect(screen.getByText('loading')).toBeTruthy()
  expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value).toContain('Договір А')
})
