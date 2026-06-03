import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createClientWorkplace,
  updateClientWorkplace,
  uploadClientContract,
} from './clientCabinetApi'
import type { Client, ClientWorkplace } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('client cabinet API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('creates workplaces with compact client and agreement references', async () => {
    const workplace = createWorkplacePayload()

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'workplace-1' })

    await createClientWorkplace(workplace)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/new/workplace', {
      method: 'POST',
      body: expect.objectContaining({
        ClientGroupId: 2,
        MainClientId: 1,
        WorkplaceClientAgreements: [
          {
            ClientAgreementId: 7,
            Id: 0,
            IsSelected: false,
            WorkplaceId: 0,
          },
        ],
      }),
    })
    const body = apiRequestMock.mock.calls[0]?.[1]?.body as ClientWorkplace
    expect(body).not.toHaveProperty('MainClient')
    expect(body).not.toHaveProperty('ClientGroup')
    expect(body.WorkplaceClientAgreements?.[0]).not.toHaveProperty('ClientAgreement')
    expect(body.WorkplaceClientAgreements?.[0]).not.toHaveProperty('Workplace')
  })

  it('updates workplaces without sending nested workplace/client graphs', async () => {
    const workplace = {
      ...createWorkplacePayload(),
      Id: 3,
      NetUid: 'workplace-1',
      WorkplaceClientAgreements: [
        {
          ClientAgreement: { Id: 7, Client: { NetUid: 'nested-client' } },
          Id: 5,
          IsSelected: true,
          NetUid: 'workplace-agreement-1',
          Workplace: { NetUid: 'recursive-workplace' },
          WorkplaceId: 3,
        },
      ],
    } as ClientWorkplace

    apiRequestMock.mockResolvedValueOnce(workplace)

    await updateClientWorkplace(workplace)

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/update/workplace', {
      method: 'POST',
      body: expect.objectContaining({
        Id: 3,
        NetUid: 'workplace-1',
        WorkplaceClientAgreements: [
          {
            ClientAgreementId: 7,
            Id: 5,
            IsSelected: true,
            NetUid: 'workplace-agreement-1',
            WorkplaceId: 3,
          },
        ],
      }),
    })
  })

  it('uploads client contracts with a compact serialized client payload', async () => {
    const client: Client = {
      ClientAgreements: [
        {
          Agreement: {
            ClientAgreements: [{ NetUid: 'recursive-agreement' }],
            ClientInDebts: [{ NetUid: 'recursive-debt' }],
            Currency: { Code: 'EUR', Id: 1, IsSelected: true },
            NetUid: 'agreement-1',
          },
          Client: { NetUid: 'nested-client' },
          NetUid: 'client-agreement-1',
        },
      ],
      ClientContractDocuments: [{ FileName: 'old.pdf' }],
      ClientInDebts: [{ NetUid: 'debt-1' }],
      FullName: 'Client',
      NetUid: 'client-1',
      SubClients: [{ NetUid: 'sub-link-1' }],
    }
    const document = new File(['contract'], 'contract.pdf', { type: 'application/pdf' })

    apiRequestMock.mockResolvedValueOnce(client)

    await uploadClientContract(client, [document])

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData
    const payload = JSON.parse(String(body.get('client'))) as Client

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/clients/documents/upload/contracts',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(body.getAll('documents')).toEqual([document])
    expect(payload).toMatchObject({ FullName: 'Client', NetUid: 'client-1' })
    expect(payload).not.toHaveProperty('ClientContractDocuments')
    expect(payload).not.toHaveProperty('ClientInDebts')
    expect(payload).not.toHaveProperty('SubClients')
    expect(payload.ClientAgreements?.[0]).not.toHaveProperty('Client')
    expect(payload.ClientAgreements?.[0]?.Agreement).not.toHaveProperty('ClientAgreements')
    expect(payload.ClientAgreements?.[0]?.Agreement).not.toHaveProperty('ClientInDebts')
    expect(payload.ClientAgreements?.[0]?.Agreement?.Currency).not.toHaveProperty('IsSelected')
  })
})

function createWorkplacePayload(): ClientWorkplace {
  return {
    ClientGroup: {
      Id: 2,
      Name: 'Group',
    },
    Email: 'user@example.com',
    FirstName: 'First',
    LastName: 'Last',
    MainClient: {
      ClientAgreements: [{ NetUid: 'recursive-agreement' }],
      Id: 1,
      NetUid: 'client-1',
    },
    PhoneNumber: '+380000000000',
    WorkplaceClientAgreements: [
      {
        ClientAgreement: {
          Agreement: {
            ClientAgreements: [{ NetUid: 'recursive-client-agreement' }],
            NetUid: 'agreement-1',
          },
          Client: { NetUid: 'nested-client' },
          Id: 7,
        },
        Id: 0,
        IsSelected: false,
        Workplace: { NetUid: 'recursive-workplace' },
        WorkplaceId: 0,
      },
    ],
  }
}
