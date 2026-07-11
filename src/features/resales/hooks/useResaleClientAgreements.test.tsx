import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getResaleClientAgreements } from '../api/resalesApi'
import type { ResaleClientAgreement } from '../types'
import {
  filterEligibleResaleClientAgreements,
  useResaleClientAgreements,
} from './useResaleClientAgreements'

vi.mock('../api/resalesApi', () => ({
  getResaleClientAgreements: vi.fn(),
}))

const getResaleClientAgreementsMock = vi.mocked(getResaleClientAgreements)

describe('resale client agreement selection', () => {
  beforeEach(() => {
    getResaleClientAgreementsMock.mockReset()
  })

  it('keeps only active, non-deleted resale agreements for the current organization', () => {
    const eligible = createAgreement(1)
    const inactive = createAgreement(2, { IsActive: false })
    const deletedAgreement = createAgreement(3, { Deleted: true })
    const deletedLink = { ...createAgreement(4), Deleted: true }
    const regular = createAgreement(5, { ForReSale: false })
    const wrongOrganization = createAgreement(6, { OrganizationId: 367 })

    expect(filterEligibleResaleClientAgreements([
      eligible,
      inactive,
      deletedAgreement,
      deletedLink,
      regular,
      wrongOrganization,
    ], 365)).toEqual([eligible])
    expect(filterEligibleResaleClientAgreements([eligible])).toEqual([])
  })

  it('ignores an older client response after a newer client is selected', async () => {
    const requests = new Map<string, {
      resolve: (agreements: ResaleClientAgreement[]) => void
      signal?: AbortSignal
    }>()

    getResaleClientAgreementsMock.mockImplementation((netId, signal) => new Promise((resolve) => {
      requests.set(netId, { resolve, signal })
    }))

    const { result } = renderHook(() => useResaleClientAgreements(365))

    act(() => {
      void result.current.loadForClient('client-a')
    })
    act(() => {
      void result.current.loadForClient('client-b')
    })

    expect(requests.get('client-a')?.signal?.aborted).toBe(true)

    await act(async () => {
      requests.get('client-b')?.resolve([createAgreement(20)])
      await Promise.resolve()
    })

    expect(result.current.agreements.map((agreement) => agreement.Id)).toEqual([20])
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      requests.get('client-a')?.resolve([createAgreement(10)])
      await Promise.resolve()
    })

    expect(result.current.agreements.map((agreement) => agreement.Id)).toEqual([20])
  })
})

function createAgreement(
  id: number,
  agreementPatch: Partial<NonNullable<ResaleClientAgreement['Agreement']>> = {},
): ResaleClientAgreement {
  return {
    Id: id,
    NetUid: `client-agreement-${id}`,
    Agreement: {
      Deleted: false,
      ForReSale: true,
      IsActive: true,
      OrganizationId: 365,
      ...agreementPatch,
    },
    Deleted: false,
  }
}
