import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  classifySalesMutationFailure,
  SALES_MUTATION_LEDGER_NOT_ENTERED,
  SALES_MUTATION_LEDGER_ROLLED_BACK,
  SALES_MUTATION_LEDGER_STATE_HEADER,
  SalesMutationPreflightValidationError,
} from './salesMutationOperation'

describe('sales mutation failure classification', () => {
  it.each([400, 409])('keeps an unmarked HTTP %s pending reconciliation', (status) => {
    expect(classifySalesMutationFailure(new ApiError('rejected', status, null)))
      .toBe('pending-reconciliation')
  })

  it('accepts the explicit top-level pre-ledger payload marker on a 400', () => {
    const error = new ApiError('validation', 400, {
      MutationLedgerState: SALES_MUTATION_LEDGER_NOT_ENTERED,
    })

    expect(classifySalesMutationFailure(error)).toBe('definitive-failure')
  })

  it('accepts the explicit pre-ledger response header on a 409', () => {
    const error = new ApiError('conflict', 409, null, {
      [SALES_MUTATION_LEDGER_STATE_HEADER]: SALES_MUTATION_LEDGER_NOT_ENTERED,
    })

    expect(classifySalesMutationFailure(error)).toBe('definitive-failure')
  })

  it('accepts an explicit confirmed-rollback response header on a 409', () => {
    const error = new ApiError('rolled back', 409, null, {
      [SALES_MUTATION_LEDGER_STATE_HEADER]: SALES_MUTATION_LEDGER_ROLLED_BACK,
    })

    expect(classifySalesMutationFailure(error)).toBe('definitive-failure')
  })

  it.each([500, 503, 504])(
    'keeps a marked HTTP %s pending because commit outcome is uncertain',
    (status) => {
      const error = new ApiError('server failure', status, {
        MutationLedgerState: SALES_MUTATION_LEDGER_ROLLED_BACK,
      })

      expect(classifySalesMutationFailure(error)).toBe('pending-reconciliation')
    },
  )

  it('settles a client preflight rejection because no request reached the server', () => {
    const error = new SalesMutationPreflightValidationError('invalid payload')

    expect(classifySalesMutationFailure(error)).toBe('definitive-failure')
  })
})
