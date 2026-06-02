import type { DashboardNode, DashboardNodeModule, IdentityResponse, UserPermission, UserProfile, UserRole } from './types'
import { translate } from '../../shared/i18n/translate'

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'
export const USER_REGION_UKRAINE = 'uk'
export const USER_REGION_POLAND = 'pl'

const nameMaxLength = 20
const emailMaxLength = 50
const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
const passwordPattern = /^.*(?=.{6,})(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=[$&+,:;=?@#|'<>._^*()%!-]).*$/
const phonePattern = /^(\d{9,10})$/i

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
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
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

  if (!middleName) {
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
    return translate('Телефон має містити 9 або 10 цифр')
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

export function getIdentityResponseError(response: IdentityResponse | null): string | null {
  const error = response?.Errors?.find((item) => item.Description?.trim())

  return error?.Description?.trim() || null
}

const MIN_DELETABLE_USER_ROLE_TYPE = 12

export function canDeleteUserRole(role?: UserRole | null): boolean {
  return typeof role?.UserRoleType === 'number' && role.UserRoleType > MIN_DELETABLE_USER_ROLE_TYPE
}

export function isNodeSelected(selectedNodes: DashboardNode[], node: DashboardNode): boolean {
  return selectedNodes.some((item) => item.NetUid === node.NetUid)
}

export function isPermissionSelected(selectedPermissions: UserPermission[], permission: UserPermission): boolean {
  return selectedPermissions.some((item) => item.NetUid === permission.NetUid)
}

export function toggleNodeSelection(selectedNodes: DashboardNode[], node: DashboardNode): DashboardNode[] {
  return isNodeSelected(selectedNodes, node)
    ? selectedNodes.filter((item) => item.NetUid !== node.NetUid)
    : [...selectedNodes, node]
}

export function togglePermissionSelection(selectedPermissions: UserPermission[], permission: UserPermission): UserPermission[] {
  return isPermissionSelected(selectedPermissions, permission)
    ? selectedPermissions.filter((item) => item.NetUid !== permission.NetUid)
    : [...selectedPermissions, permission]
}

function getModuleNodes(modules: DashboardNodeModule[]): DashboardNode[] {
  return modules.reduce<DashboardNode[]>((nodes, module) => [...(module.Children || []), ...nodes], [])
}

export function toggleAllPages(selectedNodes: DashboardNode[], modules: DashboardNodeModule[]): DashboardNode[] {
  const allNodes = getModuleNodes(modules)

  if (selectedNodes.length === 0 || selectedNodes.length < allNodes.length) {
    return allNodes
  }

  return []
}

export function toggleModuleNodes(selectedNodes: DashboardNode[], module: DashboardNodeModule): DashboardNode[] {
  const children = module.Children || []
  const allSelected = children.length > 0 && children.every((child) => isNodeSelected(selectedNodes, child))

  if (allSelected) {
    return selectedNodes.filter((item) => !children.some((child) => child.NetUid === item.NetUid))
  }

  const missing = children.filter((child) => !isNodeSelected(selectedNodes, child))

  return [...selectedNodes, ...missing]
}

export function toggleSubPermissions(selectedPermissions: UserPermission[], permissions: UserPermission[]): UserPermission[] {
  const missing = permissions.filter((permission) => !isPermissionSelected(selectedPermissions, permission))

  if (missing.length === 0 && permissions.length > 0) {
    return selectedPermissions.filter((permission) => !permissions.some((item) => item.NetUid === permission.NetUid))
  }

  return [...selectedPermissions, ...missing]
}
