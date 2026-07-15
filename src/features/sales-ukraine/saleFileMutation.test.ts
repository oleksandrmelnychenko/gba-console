import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  advanceSaleFileMutationSession,
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContext,
  getLegacySaleFileMutationContextFromContext,
  getSaleFileMutationContext,
  persistSaleFileMutationSubmission,
  resumeSaleFileMutationSubmission,
  restoreSaleFileMutationSubmission,
  SALE_FILE_MUTATION_SURFACES,
} from './saleFileMutation'

describe('sale file mutation idempotency', () => {
  it('uses distinct management and wizard scopes while retaining the legacy scope explicitly', () => {
    const currentSale = { NetUid: 'SALE-1' }
    const managementContext = getSaleFileMutationContext(currentSale)
    const wizardContext = getSaleFileMutationContext(
      currentSale,
      SALE_FILE_MUTATION_SURFACES.wizard,
    )

    expect(managementContext).toBe('sale-file:sale-management:sale-1')
    expect(wizardContext).toBe('sale-file:new-sale-wizard:sale-1')
    expect(getLegacySaleFileMutationContext(currentSale)).toBe('sale-file:sale-1')
    expect(getLegacySaleFileMutationContextFromContext(managementContext)).toBe('sale-file:sale-1')
    expect(getLegacySaleFileMutationContextFromContext(wizardContext)).toBe('sale-file:sale-1')
  })

  it('retries an unknown update-file outcome with the same key and byte-identical sale JSON', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const original = { Comment: 'before timeout', NetUid: 'sale-1' }
    const submission = await createSaleFileMutationSubmission('sale-update-file', original, null, operationId)
    const serialized: string[] = []
    const operationIds: string[] = []
    const request = vi
      .fn()
      .mockImplementationOnce(async (sale, _file, operation) => {
        serialized.push(JSON.stringify(sale))
        operationIds.push(operation.operationId)
        throw new ApiError('response lost', 500, null)
      })
      .mockImplementationOnce(async (sale, _file, operation) => {
        serialized.push(JSON.stringify(sale))
        operationIds.push(operation.operationId)

        return { message: 'replayed', sale: { NetUid: 'sale-1' } }
      })

    const first = await advanceSaleFileMutationSession({
      kind: 'sale-update-file',
      request,
      submission,
    })

    expect(first.status).toBe('pending-reconciliation')
    original.Comment = 'edited after timeout'
    const retry = await advanceSaleFileMutationSession({
      kind: 'sale-update-file',
      request,
      submission,
    })

    expect(retry.status).toBe('reconciled')
    expect(operationIds).toEqual([operationId, operationId])
    expect(serialized[1]).toBe(serialized[0])
    expect(serialized[0]).toContain('before timeout')
    expect(serialized[0]).not.toContain('edited after timeout')
  })

  it('settles a marked pre-ledger retry rejection so corrected data can use a new key', async () => {
    const firstKey = '22222222-2222-4222-8222-222222222222'
    const nextKey = '33333333-3333-4333-8333-333333333333'
    const firstSubmission = await createSaleFileMutationSubmission(
      'sale-vat-document',
      { Comment: 'old', NetUid: 'sale-1' },
      null,
      firstKey,
    )
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('timeout', 500, null))
      .mockRejectedValueOnce(new ApiError('validation', 400, null, {
        'X-Mutation-Ledger-State': 'not-entered',
      }))
      .mockResolvedValueOnce({ pdfUrl: 'document.pdf' })

    const unknown = await advanceSaleFileMutationSession({
      kind: 'sale-vat-document',
      request,
      submission: firstSubmission,
    })
    const definitive = await advanceSaleFileMutationSession({
      kind: 'sale-vat-document',
      request,
      submission: firstSubmission,
    })
    const corrected = await advanceSaleFileMutationSession({
      kind: 'sale-vat-document',
      request,
      submission: await createSaleFileMutationSubmission(
        'sale-vat-document',
        { Comment: 'corrected', NetUid: 'sale-1' },
        null,
        nextKey,
      ),
    })

    expect(unknown.status).toBe('pending-reconciliation')
    expect(definitive).toEqual({
      error: expect.any(ApiError),
      status: 'definitive-failure',
      submission: null,
    })
    expect(corrected.status).toBe('reconciled')
    expect(request.mock.calls.map((call) => call[2]?.operationId)).toEqual([firstKey, firstKey, nextKey])
  })

  it('restores no-file submissions and resumes a reselected byte-identical file after reload', async () => {
    const noFile = await createSaleFileMutationSubmission(
      'sale-update-file',
      { NetUid: 'sale-1' },
      null,
      '44444444-4444-4444-8444-444444444444',
    )
    const sourceFile = new File(['payload'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })
    const withFile = await createSaleFileMutationSubmission(
      'sale-update-file',
      { NetUid: 'sale-1' },
      sourceFile,
      '55555555-5555-4555-8555-555555555555',
    )
    const persistedWithFile = persistSaleFileMutationSubmission(withFile)
    const reselectedFile = new File(['payload'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })

    expect(restoreSaleFileMutationSubmission(persistSaleFileMutationSubmission(noFile))).toMatchObject({
      file: null,
      operationId: noFile.operationId,
    })
    expect(restoreSaleFileMutationSubmission(persistedWithFile)).toBe(null)

    const resumed = await resumeSaleFileMutationSubmission(persistedWithFile, reselectedFile)

    expect(resumed).toMatchObject({
      file: reselectedFile,
      operationId: withFile.operationId,
      payload: withFile.payload,
    })
    expect(resumed.fileMetadata?.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps a persisted file operation fail-closed when the reselected bytes differ', async () => {
    const originalFile = new File(['expected'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { NetUid: 'sale-1' },
      originalFile,
      '66666666-6666-4666-8666-666666666666',
    )
    const sameMetadataDifferentBytes = new File(['tampered'], 'ttn.pdf', {
      lastModified: 123,
      type: 'application/pdf',
    })

    await expect(
      resumeSaleFileMutationSubmission(
        persistSaleFileMutationSubmission(submission),
        sameMetadataDifferentBytes,
      ),
    ).rejects.toThrow('SHA-256')
  })
})
