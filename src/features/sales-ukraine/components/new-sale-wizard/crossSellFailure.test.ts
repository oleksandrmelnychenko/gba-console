import { expect, it } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { crossSellFailure } from './crossSellFailure'
import fixture from './crossSellFailure.server-fixture.json'
const code = 'ai_agreement_unavailable'
it('accepts only the authoritative typed agreement refusal with matching HTTP status', () => {
 expect(fixture.StatusCode).toBe(404);expect(fixture.ErrorCode).toBe(code)
 expect(crossSellFailure(new ApiError(fixture.Message,fixture.StatusCode,fixture))).toBe('agreementUnavailable')
})
it.each([
 new Error(code),
 {status:404,payload:{ErrorCode:code}},
 new ApiError(code,404,null),
 new ApiError(code,404,{Message:code}),
 new ApiError(code,404,{ErrorCode:'ai_not_found'}),
 new ApiError(code,404,{errorCode:code}),
 new ApiError(code,404,[{ErrorCode:code}]),
 new ApiError(code,503,{ErrorCode:code}),
 new ApiError(code,400,{ErrorCode:code}),
 new ApiError(code,0,{ErrorCode:code}),
])('keeps client/product absence, untyped old-server failures and transient errors generic (%#)',error=>{
 expect(crossSellFailure(error)).toBe('unknown')
})
