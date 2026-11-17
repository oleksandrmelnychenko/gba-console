import { describe, expect, it } from 'vitest'

import { ApiError } from '../../shared/api/apiClient'
import {
  getIdentityResponseError,
  getUserSaveErrorMessage,
  normalizeUserForSave,
  validatePasswordPair,
  validateUserProfile,
} from './utils'

describe('validatePasswordPair', () => {
  it('accepts a valid password with a special character in the middle', () => {
    expect(validatePasswordPair('Hrimm_jow92', 'Hrimm_jow92')).toBeNull()
  })

  it('rejects a password without a special character', () => {
    expect(validatePasswordPair('Hrimmjow92', 'Hrimmjow92')).not.toBeNull()
  })
})

describe('validateUserProfile', () => {
  const role = { Id: 3, Name: 'Менеджер', NetUid: 'role-manager' }
  const baseUser = {
    Email: 'qa@example.com',
    FirstName: 'Олена',
    LastName: 'Коваль',
    MiddleName: '',
    PhoneNumber: '0966666666',
    UserRole: role,
  }

  it('accepts the stored 12-digit 380 login of seeded users as well as 9-10 digits', () => {
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '380000000121' })).toBeNull()
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '0966666666' })).toBeNull()
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '966666666' })).toBeNull()
  })

  it('rejects other phone formats', () => {
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '09666666666' })).not.toBeNull()
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '381000000121' })).not.toBeNull()
    expect(validateUserProfile({ ...baseUser, PhoneNumber: '+380000000121' })).not.toBeNull()
  })

  it('keeps the phone exactly as stored when normalising for save', () => {
    expect(normalizeUserForSave({ ...baseUser, PhoneNumber: ' 380000000121 ' }).PhoneNumber).toBe('380000000121')
  })

  it('lets existing users without a patronymic be saved; create still requires it', () => {
    expect(validateUserProfile(baseUser)).toBeNull()
    expect(validateUserProfile(baseUser, { requireMiddleName: true })).toBe('Вкажіть по батькові')
  })
})

describe('user save errors', () => {
  it('names the duplicate field instead of the generic identity text', () => {
    expect(getIdentityResponseError({
      Errors: [{ Code: 'DuplicateUserName', Description: "Username '380000000121' is already taken." }],
      Succeeded: false,
    })).toBe('Користувач з таким телефоном уже існує')
    expect(getIdentityResponseError({
      Errors: [{ Code: 'DuplicateEmail', Description: "Email 'a@b.c' is already taken." }],
      Succeeded: false,
    })).toBe('Користувач з таким email уже існує')
  })

  it("shows the server's field-specific message from a 400 body", () => {
    const message = 'Користувач з таким email уже існує.'
    expect(getUserSaveErrorMessage(new ApiError(message, 400, { Message: message }), 'fallback')).toBe(message)
    expect(getUserSaveErrorMessage(
      new ApiError('x', 400, { Body: { Errors: [{ Code: 'DuplicateUserName' }], Succeeded: false } }),
      'fallback',
    )).toBe('Користувач з таким телефоном уже існує')
    expect(getUserSaveErrorMessage(null, 'fallback')).toBe('fallback')
  })
})
