import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../../shared/theme/theme'
import type { ClientCommercialStructure } from '../../types'
import { ClientCommercialStructureView } from './ClientCommercialStructureView'

const t = (value: string) => value

describe('ClientCommercialStructureView', () => {
  it('shows the hierarchy, raw 1C evidence and a non-destructive review warning', () => {
    render(
      <MantineProvider theme={theme}>
        <ClientCommercialStructureView structure={createStructure()} t={t} />
      </MantineProvider>,
    )

    expect(screen.getByText('Комерційна група · XM052')).toBeTruthy()
    expect(screen.getByText('Структура потребує перевірки')).toBeTruthy()
    expect(screen.getByText(/Договори, продажі й баланси не переміщуються/)).toBeTruthy()
    expect(screen.getAllByText('ТОВ МАГРОМ')).toHaveLength(3)
    expect(screen.getByText('BXM05202')).toBeTruthy()
    expect(screen.getByText('AMG')).toBeTruthy()
    expect(screen.getByText('Пошкоджений ідентифікатор джерела — потрібна перевірка')).toBeTruthy()
    expect(screen.getByText('Картку позначено видаленою у 1С — не використовуйте без перевірки')).toBeTruthy()
    expect(screen.getByText('Пошкоджене або надмірно довге значення з 1С нормалізовано — перевірте оригінал')).toBeTruthy()
  })

  it('makes a truncated candidate set impossible to mistake for a complete group', () => {
    render(
      <MantineProvider theme={theme}>
        <ClientCommercialStructureView
          structure={{ ...createStructure(), IsPartial: true }}
          t={t}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Група надто велика: показано лише безпечну частину кандидатів')).toBeTruthy()
  })
})

function createStructure(): ClientCommercialStructure {
  return {
    ClientNetUid: '11111111-1111-1111-1111-111111111111',
    AsOfUtc: '2026-08-11T12:00:00Z',
    GroupKey: 'XM052',
    GroupName: null,
    State: 'review_required',
    RequiresReview: true,
    IsPartial: false,
    CardCount: 1,
    AgreementCount: 2,
    ActiveAgreementCount: 1,
    SaleCount: 7,
    Reasons: ['region_code_family', 'invalid_source_identity'],
    LegalParties: [{
      Key: 'legal:01234567',
      DisplayName: 'ТОВ МАГРОМ',
      NormalizedLegalCode: '01234567',
      State: 'self',
      IsTarget: true,
      RequiresReview: false,
      AgreementCount: 2,
      ActiveAgreementCount: 1,
      SaleCount: 7,
      Reasons: ['same_legal_code'],
      Cards: [{
        ClientId: 10,
        ClientNetUid: '11111111-1111-1111-1111-111111111111',
        DisplayName: 'ТОВ МАГРОМ',
        CurrentRegionCode: 'BXM05202',
        OriginalRegionCode: 'BXM05202',
        Usreou: '01234567',
        Tin: null,
        RoleType: 0,
        RoleName: 'Покупець',
        MainClientId: null,
        IsSubClient: false,
        IsTradePoint: false,
        IsActive: true,
        IsBlocked: false,
        IsTarget: true,
        HasExplicitRelationship: false,
        AgreementCount: 2,
        ActiveAgreementCount: 1,
        SaleCount: 7,
        Reasons: ['invalid_source_identity'],
        SourceSnapshots: [{
          SourceSystem: 'amg',
          SourceCode: 1545,
          ClientName: 'МАГРОМ ТОВ',
          FullName: 'ТОВ МАГРОМ',
          Tin: null,
          Usreou: '01234567',
          RegionCode: 'BXM05202',
          RegionName: 'Хмельницький',
          MainClientCode: 1545,
          MainClientName: 'Хмельницький - Назаришин В.М.',
          DirectClientGroupName: null,
          ClientGroupName: null,
          SourceMarkedDeleted: true,
          SourceIdentityValid: false,
          EvidenceTruncated: true,
          LastSeenAtUtc: '2026-08-11T11:00:00Z',
        }],
      }],
    }],
  }
}
