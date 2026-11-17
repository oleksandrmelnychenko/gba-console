import {
  PasswordInput,
  Select,
  SimpleGrid,
  TextInput,
} from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { UserProfile, UserRole } from '../types'
import { getUserRoleKey, getUserRoleName, type UserFieldError, type UserFormField } from '../utils'

type UserFormProps = {
  confirmPassword?: string
  disabled?: boolean
  /** Validation message shown under the field it is about (the forms use noValidate, no browser tooltips). */
  fieldError?: UserFieldError | null
  includePassword?: boolean
  password?: string
  roles: UserRole[]
  user: UserProfile
  onFieldChange: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void
  onPasswordChange?: (field: 'password' | 'confirmPassword', value: string) => void
}

export function UserForm({
  confirmPassword = '',
  disabled = false,
  fieldError = null,
  includePassword = false,
  password = '',
  roles,
  user,
  onFieldChange,
  onPasswordChange,
}: UserFormProps) {
  const { t } = useI18n()
  const errorOf = (field: UserFormField) => (fieldError?.field === field ? fieldError.message : undefined)
  const roleOptions = roles.reduce<Array<{ label: string; value: string }>>((options, role) => {
    const value = getUserRoleKey(role)

    if (value) {
      options.push({
        value,
        label: getUserRoleName(role),
      })
    }

    return options
  }, [])
  const selectedRoleKey = user.UserRole ? getUserRoleKey(user.UserRole) : ''
  const roleData = selectedRoleKey && !roleOptions.some((role) => role.value === selectedRoleKey)
    ? [
        ...roleOptions,
        {
          value: selectedRoleKey,
          label: getUserRoleName(user.UserRole),
        },
      ]
    : roleOptions

  function selectRole(value: string | null) {
    const role = roles.find((item) => getUserRoleKey(item) === value) || user.UserRole

    onFieldChange('UserRole', role)
    onFieldChange('UserRoleId', role?.Id)
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={10}>
      <TextInput
        disabled={disabled}
        error={errorOf('LastName')}
        label={t('Прізвище')}
        maxLength={20}
        required
        value={user.LastName || ''}
        onChange={(event) => onFieldChange('LastName', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        error={errorOf('FirstName')}
        label={t("Ім'я")}
        maxLength={20}
        required
        value={user.FirstName || ''}
        onChange={(event) => onFieldChange('FirstName', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        error={errorOf('MiddleName')}
        label={t('По батькові')}
        maxLength={20}
        value={user.MiddleName || ''}
        onChange={(event) => onFieldChange('MiddleName', event.currentTarget.value)}
      />
      <TextInput
        autoComplete={includePassword ? 'off' : 'email'}
        disabled={disabled}
        error={errorOf('Email')}
        label="Email"
        maxLength={50}
        required
        type="email"
        value={user.Email || ''}
        onChange={(event) => onFieldChange('Email', event.currentTarget.value)}
      />
      <TextInput
        disabled={disabled}
        inputMode="numeric"
        error={errorOf('PhoneNumber')}
        label={t('Телефон')}
        maxLength={12}
        required
        value={user.PhoneNumber || ''}
        onChange={(event) => onFieldChange('PhoneNumber', event.currentTarget.value)}
      />
      <Select
        clearable={false}
        data={roleData}
        disabled={disabled}
        error={errorOf('UserRole')}
        label={t('Роль')}
        nothingFoundMessage={t('Ролей не знайдено')}
        required
        searchable
        value={selectedRoleKey || null}
        onChange={selectRole}
      />
      {includePassword && (
        <>
          <PasswordInput
            autoComplete="new-password"
            disabled={disabled}
            error={errorOf('password')}
            label={t('Пароль')}
            required
            value={password}
            onChange={(event) => onPasswordChange?.('password', event.currentTarget.value)}
          />
          <PasswordInput
            autoComplete="new-password"
            disabled={disabled}
            error={errorOf('confirmPassword')}
            label={t('Підтвердження пароля')}
            required
            value={confirmPassword}
            onChange={(event) => onPasswordChange?.('confirmPassword', event.currentTarget.value)}
          />
        </>
      )}
    </SimpleGrid>
  )
}
