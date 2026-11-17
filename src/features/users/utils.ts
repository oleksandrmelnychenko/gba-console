import type { IdentityResponse, UserProfile, UserRole } from './types'
import { translate } from '../../shared/i18n/translate'

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'
export const USER_REGION_UKRAINE = 'uk'
export const USER_REGION_POLAND = 'pl'

const nameMaxLength = 20
const emailMaxLength = 50
const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
const passwordPattern = /^(?=.{6,})(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[$&+,:;=?@#|'<>._^*()%!-]).*$/
// New users are created with the 9-10 digits typed in; seeded and imported logins are stored as 380XXXXXXXXX.
// The phone is the login, so it is sent exactly as stored (never rewritten) to keep the login unchanged.
const phonePattern = /^(\d{9,10}|380\d{9})$/

export function createEmptyUserProfile(): UserProfile {
  return {
    Deleted: false,
    Id: 0,
    IsActive: true,
    NetUid: EMPTY_NET_UID,
    Region: USER_REGION_UKRAINE,
  }
}

export function getUserFullName(user: UserProfile): string {
  const fullName = joinTrimmedParts([user.LastName, user.FirstName, user.MiddleName], ' ')

  return fullName || user.FullName?.trim() || user.Email?.trim() || translate('Без імені')
}

function joinTrimmedParts(parts: Array<string | undefined | null>, separator: string): string {
  return parts.reduce<string[]>((values, part) => {
    const value = part?.trim()

    if (value) {
      values.push(value)
    }

    return values
  }, []).join(separator)
}

export function getUserRoleName(role?: UserRole | null): string {
  return role?.Name?.trim() || translate('Без ролі')
}

export function getUserRoleKey(role: UserRole): string {
  return role.NetUid || String(role.Id || '')
}

export function getUserRegionName(region?: string | null): string {
  if (region === USER_REGION_POLAND) {
    return translate('Польща')
  }

  if (region === USER_REGION_UKRAINE) {
    return translate('Україна')
  }

  return displayValue(region)
}

export function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  // Empty values render as blank (no dash placeholder) — docs/ui-patterns.md §5.
  return value?.trim() || ''
}

export function normalizeUserForSave(user: UserProfile): UserProfile {
  const role = user.UserRole

  return {
    ...user,
    Email: user.Email?.trim(),
    FirstName: user.FirstName?.trim(),
    LastName: user.LastName?.trim(),
    MiddleName: user.MiddleName?.trim(),
    PhoneNumber: user.PhoneNumber?.trim(),
    Region: user.Region || USER_REGION_UKRAINE,
    UserRole: role,
    UserRoleId: role?.Id || user.UserRoleId,
  }
}

export function validateUserProfile(
  user: UserProfile,
  options: {
    confirmPassword?: string
    password?: string
    requireMiddleName?: boolean
    requirePassword?: boolean
  } = {},
): string | null {
  const firstName = user.FirstName?.trim() || ''
  const lastName = user.LastName?.trim() || ''
  const middleName = user.MiddleName?.trim() || ''
  const email = user.Email?.trim() || ''
  const phone = user.PhoneNumber?.trim() || ''
  const password = options.password || ''
  const confirmPassword = options.confirmPassword || ''

  if (!lastName) {
    return translate('Вкажіть прізвище')
  }

  if (lastName.length > nameMaxLength) {
    return translate('Прізвище має містити не більше {count} символів', { count: nameMaxLength })
  }

  if (!firstName) {
    return translate("Вкажіть ім'я")
  }

  if (firstName.length > nameMaxLength) {
    return translate("Ім'я має містити не більше {count} символів", { count: nameMaxLength })
  }

  // Existing users (drivers, seeded accounts) may have no patronymic; it is required only on create.
  if (!middleName && options.requireMiddleName) {
    return translate('Вкажіть по батькові')
  }

  if (middleName.length > nameMaxLength) {
    return translate('По батькові має містити не більше {count} символів', { count: nameMaxLength })
  }

  if (!email || !emailPattern.test(email)) {
    return translate('Вкажіть коректний email')
  }

  if (email.length > emailMaxLength) {
    return translate('Email має містити не більше {count} символів', { count: emailMaxLength })
  }

  if (!phone || !phonePattern.test(phone)) {
    return translate('Телефон має містити 9 або 10 цифр, або 12 цифр у форматі 380XXXXXXXXX')
  }

  if (!user.UserRole || !getUserRoleKey(user.UserRole)) {
    return translate('Оберіть роль')
  }

  if (options.requirePassword || password || confirmPassword) {
    const passwordError = validatePasswordPair(password, confirmPassword)

    if (passwordError) {
      return passwordError
    }
  }

  return null
}

export function validatePasswordPair(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) {
    return translate('Вкажіть пароль та підтвердження')
  }

  if (password !== confirmPassword) {
    return translate('Паролі не збігаються')
  }

  if (!passwordPattern.test(password)) {
    return translate('Пароль має містити мінімум 6 символів, цифру, літеру та спецсимвол')
  }

  return null
}

// ASP.NET Identity reports duplicates with English descriptions; name the field in Ukrainian instead.
const identityErrorMessages: Record<string, string> = {
  DuplicateEmail: 'Користувач з таким email уже існує',
  DuplicateUserName: 'Користувач з таким телефоном уже існує',
  InvalidEmail: 'Вкажіть коректний email',
  InvalidUserName: 'Телефон містить недопустимі символи',
}

export function getIdentityResponseError(response: IdentityResponse | null): string | null {
  const knownError = response?.Errors?.find((item) => item.Code && identityErrorMessages[item.Code])

  if (knownError?.Code) {
    return translate(identityErrorMessages[knownError.Code])
  }

  const error = response?.Errors?.find((item) => item.Description?.trim())

  return error?.Description?.trim() || null
}

/** The message for a failed user create/edit: identity errors carried in the error body, else the server's message. */
export function getUserSaveErrorMessage(error: unknown, fallback: string): string {
  const payload = error && typeof error === 'object' && 'payload' in error
    ? (error as { payload?: unknown }).payload
    : null
  const body = payload && typeof payload === 'object' && 'Body' in payload
    ? (payload as { Body?: unknown }).Body
    : payload
  const identityError = body && typeof body === 'object' && 'Errors' in body
    ? getIdentityResponseError(body as IdentityResponse)
    : null

  if (identityError) {
    return identityError
  }

  return error instanceof Error && error.message ? error.message : fallback
}

const MIN_DELETABLE_USER_ROLE_TYPE = 12

export function canDeleteUserRole(role?: UserRole | null): boolean {
  return typeof role?.UserRoleType === 'number' && role.UserRoleType > MIN_DELETABLE_USER_ROLE_TYPE
}
