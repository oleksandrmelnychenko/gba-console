import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSettlementPeriodAgreements } from './settlementPeriodApi'
import { settlementPeriodAgreement as agreement } from '../data/settlementPeriod.test-fixtures'
import type { SettlementNativeFamily, SettlementSourceWorld } from '../data/settlementPeriod'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it.each(['Fenix', 'Amg'] as const)('reads bounded %s exact IDs without numeric conversion and passes cancellation', async world => {
  const controller = new AbortController()
  const row = { ...agreement, SourceWorld: world, NativeFamily: 'SupplyOrganizationAgreement' }
  api.mockResolvedValue([row])
  await expect(getSettlementPeriodAgreements(world, 'SupplyOrganizationAgreement', '9007199254740993', 30, controller.signal)).resolves.toEqual([row])
  expect(api).toHaveBeenCalledWith('/report/datasets/41/agreements', {
    query: { sourceWorld: world, nativeFamily: 'SupplyOrganizationAgreement', afterId: '9007199254740993', limit: 30 }, signal: controller.signal,
  })
})

it.each([
  { AgreementId: 9007199254740992 }, { AgreementId: '9223372036854775808' }, { AgreementId: '01' },
  { AgreementNetUid: '00000000-0000-0000-0000-000000000000' }, { SourceWorld: 'Amg' },
  { NativeFamily: 'SupplyOrganizationAgreement' }, { CurrencyCode: '000' }, { CurrencyCode: null },
  { Unknown: true },
])('refuses incomplete identity, another cohort or unknown currency: %j', async patch => {
  api.mockResolvedValue([{ ...agreement, ...patch }])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement')).rejects.toThrow('ідентичності')
})

it('refuses duplicate, non-monotone and past-cursor IDs as well as an unexpected envelope', async () => {
  api.mockResolvedValue([agreement, agreement])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement')).rejects.toThrow('повторні')
  api.mockResolvedValue([agreement, { ...agreement, AgreementId: '2' }])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement')).rejects.toThrow('неупорядковані')
  api.mockResolvedValue([agreement])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement', agreement.AgreementId)).rejects.toThrow('повторні')
  api.mockResolvedValue({ Rows: [agreement] })
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement')).rejects.toThrow('сторінку')
  api.mockResolvedValue([agreement, agreement])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement', '0', 1)).rejects.toThrow('сторінку')
})

it('allows absent captions without using them as identity or currency evidence', async () => {
  api.mockResolvedValue([{ ...agreement, OrganizationName: null, CounterpartyName: null, AgreementName: null, CurrencyName: null }])
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement')).resolves.toEqual([
    { ...agreement, OrganizationName: '', CounterpartyName: '', AgreementName: '', CurrencyName: '' },
  ])
})

it('rejects implicit worlds, families and unbounded pages before any request', async () => {
  await expect(getSettlementPeriodAgreements('' as SettlementSourceWorld, 'ClientAgreement')).rejects.toThrow('сторінка')
  await expect(getSettlementPeriodAgreements('Fenix', 'Buyer' as SettlementNativeFamily)).rejects.toThrow('сторінка')
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement', '01')).rejects.toThrow('сторінка')
  await expect(getSettlementPeriodAgreements('Fenix', 'ClientAgreement', '0', 51)).rejects.toThrow('сторінка')
  expect(api).not.toHaveBeenCalled()
})
