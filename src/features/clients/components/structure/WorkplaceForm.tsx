import { getOrganizationDisplayName } from '../../../../shared/organizations/organizationDisplayName'
import {
  Button,
  Card,
  Checkbox,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { AppModalFooter } from '../../../../shared/ui/AppModal'
import { TableChip } from '../../../../shared/ui/TableChip'
import '../form/client-inline-form.css'
import { Check } from 'lucide-react'
import { useReducer } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { Client, ClientAgreement, ClientGroup, ClientWorkplace } from '../../types'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'

const WITHOUT_GROUP_ID = 0
const WITHOUT_GROUP_NAME = '-- Без групи --'

export type WorkplaceFormValues = {
  LastName: string
  FirstName: string
  MiddleName: string
  Email: string
  PhoneNumber: string
  Password: string
}

export type WorkplaceFormProps = {
  client: Client
  groups: ClientGroup[]
  workplace?: ClientWorkplace | null
  disabled?: boolean
  onSubmit: (workplace: ClientWorkplace) => void
  onCancel?: () => void
}

function toFormValues(workplace?: ClientWorkplace | null): WorkplaceFormValues {
  return {
    LastName: workplace?.LastName || '',
    FirstName: workplace?.FirstName || '',
    MiddleName: workplace?.MiddleName || '',
    Email: workplace?.Email || '',
    PhoneNumber: workplace?.PhoneNumber || '',
    Password: '',
  }
}

function getInitialGroup(workplace: ClientWorkplace | null | undefined, groups: ClientGroup[]): ClientGroup {
  if (workplace && workplace.ClientGroupId !== null && workplace.ClientGroupId !== undefined) {
    const matched = groups.find((group) => group.Id === workplace.ClientGroupId)

    if (matched) {
      return matched
    }
  }

  return { Id: WITHOUT_GROUP_ID, Name: WITHOUT_GROUP_NAME }
}

function getInitialAgreements(workplace?: ClientWorkplace | null): ClientAgreement[] {
  return (workplace?.WorkplaceClientAgreements || [])
    .map((item) => item.ClientAgreement)
    .filter((agreement): agreement is ClientAgreement => Boolean(agreement))
}

type WorkplaceFormState = {
  isWorkplaceMode: boolean
  values: WorkplaceFormValues
  selectedGroup: ClientGroup
  selectedAgreements: ClientAgreement[]
  showErrors: boolean
}

type WorkplaceFormAction =
  | { type: 'setWorkplaceMode'; checked: boolean }
  | { type: 'updateField'; key: keyof WorkplaceFormValues; value: string }
  | { type: 'selectGroup'; group: ClientGroup }
  | { type: 'toggleAgreement'; agreement: ClientAgreement }
  | { type: 'showErrors' }

function createWorkplaceFormState(
  workplace: ClientWorkplace | null | undefined,
  groups: ClientGroup[],
  isEdit: boolean,
): WorkplaceFormState {
  return {
    isWorkplaceMode: isEdit,
    values: toFormValues(workplace),
    selectedGroup: getInitialGroup(workplace, groups),
    selectedAgreements: getInitialAgreements(workplace),
    showErrors: false,
  }
}

function workplaceFormReducer(state: WorkplaceFormState, action: WorkplaceFormAction): WorkplaceFormState {
  switch (action.type) {
    case 'setWorkplaceMode':
      return { ...state, isWorkplaceMode: action.checked }
    case 'updateField':
      return {
        ...state,
        values: {
          ...state.values,
          [action.key]: action.value,
        },
      }
    case 'selectGroup':
      return { ...state, selectedGroup: action.group }
    case 'toggleAgreement': {
      const exists = state.selectedAgreements.some((item) => item.NetUid === action.agreement.NetUid)

      return {
        ...state,
        selectedAgreements: exists
          ? state.selectedAgreements.filter((item) => item.NetUid !== action.agreement.NetUid)
          : [...state.selectedAgreements, action.agreement],
      }
    }
    case 'showErrors':
      return { ...state, showErrors: true }
    default:
      return state
  }
}

function getWorkplaceFormKey(workplace?: ClientWorkplace | null): string {
  if (!workplace) {
    return 'new'
  }

  return [
    workplace.NetUid,
    workplace.Id,
    workplace.LastName,
    workplace.FirstName,
    workplace.MiddleName,
    workplace.Email,
    workplace.PhoneNumber,
    workplace.ClientGroupId,
  ].join('|')
}

export function WorkplaceForm(props: WorkplaceFormProps) {
  return <WorkplaceFormFields key={getWorkplaceFormKey(props.workplace)} {...props} />
}

function WorkplaceFormFields({
  client,
  groups,
  workplace,
  disabled = false,
  onSubmit,
  onCancel,
}: WorkplaceFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(workplace && (workplace.Id || 0) > 0)
  const [{ isWorkplaceMode, values, selectedGroup, selectedAgreements, showErrors }, dispatch] = useReducer(
    workplaceFormReducer,
    undefined,
    () => createWorkplaceFormState(workplace, groups, isEdit),
  )

  const lastNameError = !values.LastName.trim() ? '*' : undefined
  const firstNameError = !values.FirstName.trim() ? '*' : undefined
  const emailError = !values.Email.trim() ? '*' : undefined
  const phoneError = !values.PhoneNumber.trim() ? '*' : undefined
  const isValid = !lastNameError && !firstNameError && !emailError && !phoneError

  const groupOptions = [{ Id: WITHOUT_GROUP_ID, Name: WITHOUT_GROUP_NAME } as ClientGroup, ...groups]
  const availableAgreements = (client.ClientAgreements || []).filter(
    (item) => item.Agreement && !item.Agreement.ForReSale,
  )

  function update<K extends keyof WorkplaceFormValues>(key: K, value: string) {
    dispatch({ type: 'updateField', key, value })
  }

  function handleGroupChange(value: string | null) {
    const matched = groupOptions.find((group) => String(group.Id) === value)
    dispatch({ type: 'selectGroup', group: matched || { Id: WITHOUT_GROUP_ID, Name: WITHOUT_GROUP_NAME } })
  }

  function toggleAgreement(agreement: ClientAgreement) {
    dispatch({ type: 'toggleAgreement', agreement })
  }

  function buildBasePayload(): ClientWorkplace {
    const hasGroup = Boolean(selectedGroup && selectedGroup.Id !== WITHOUT_GROUP_ID)

    return {
      FirstName: values.FirstName,
      LastName: values.LastName,
      MiddleName: values.MiddleName,
      Email: values.Email,
      PhoneNumber: values.PhoneNumber,
      Region: 'uk',
      Password: values.Password,
      ClientGroupId: hasGroup ? selectedGroup.Id : undefined,
      ClientGroup: hasGroup ? selectedGroup : null,
      MainClientId: client.Id,
      MainClient: client,
    }
  }

  function handleSubmit() {
    if (!isValid) {
      dispatch({ type: 'showErrors' })
      return
    }

    const basePayload = buildBasePayload()

    if (!isEdit) {
      onSubmit({
        ...basePayload,
        WorkplaceClientAgreements: selectedAgreements.map((item) => ({
          ClientAgreement: item,
          ClientAgreementId: item.Id,
          WorkplaceId: workplace?.Id || 0,
        })),
      })
      return
    }

    onSubmit({
      ...workplace,
      ...basePayload,
      WorkplaceClientAgreements: selectedAgreements.map((item) => {
        const existing = (workplace?.WorkplaceClientAgreements || []).find(
          (entry) => entry.ClientAgreement?.NetUid === item.NetUid,
        )

        return {
          NetUid: existing ? existing.NetUid : undefined,
          IsSelected: existing ? existing.IsSelected : false,
          Id: existing ? existing.Id : 0,
          ClientAgreement: item,
          ClientAgreementId: item.Id,
          WorkplaceId: workplace?.Id || 0,
        }
      }),
    })
  }

  return (
    <Stack className="app-compact-form" gap={10}>
      <Checkbox
        checked={isWorkplaceMode}
        disabled={disabled}
        label={t('Робоче місце')}
        onChange={(event) => dispatch({ type: 'setWorkplaceMode', checked: event.currentTarget.checked })}
      />

      {isWorkplaceMode && (
        <>
          <Card className="app-section-card" withBorder>
            <Stack gap={10}>
              <Select
                clearable={false}
                data={groupOptions.map((group) => ({
                  value: String(group.Id),
                  label: group.Name || '',
                }))}
                disabled={disabled}
                label={t('Група')}
                value={String(selectedGroup.Id)}
                onChange={handleGroupChange}
              />

              <Stack className="client-inline-form__agreements" gap={6}>
                <Text fw={500} size="sm">
                  {t('Договори')}
                </Text>
                {availableAgreements.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    {t('Договорів не додано')}
                  </Text>
                ) : (
                  availableAgreements.map((item) => {
                    const isSelected = selectedAgreements.some((agreement) => agreement.NetUid === item.NetUid)

                    return (
                      <UnstyledButton
                        key={item.NetUid}
                        disabled={disabled}
                        className="client-inline-form__agreement"
                        aria-pressed={isSelected}
                        onClick={() => toggleAgreement(item)}
                      >
                        <Stack gap={2}>
                          <TableChip tone="product" value={getOrganizationDisplayName(item.Agreement?.Organization)} />
                          <Group gap={4} align="center">
                            {item.Agreement?.Currency?.Code && (
                              <TableChip tone="source" value={item.Agreement.Currency.Code} />
                            )}
                            <Text size="sm">{item.Agreement?.Name}</Text>
                          </Group>
                        </Stack>
                      </UnstyledButton>
                    )
                  })
                )}
              </Stack>

            </Stack>
          </Card>
          <Card className="app-section-card client-inline-form__fields" withBorder>
            <TextInput
              error={showErrors ? lastNameError : undefined}
              label={t('Прізвище')}
              required
              value={values.LastName}
              onChange={(event) => update('LastName', event.currentTarget.value)}
            />
            <TextInput
              error={showErrors ? firstNameError : undefined}
              label={t("Ім'я")}
              required
              value={values.FirstName}
              onChange={(event) => update('FirstName', event.currentTarget.value)}
            />
            <TextInput
              label={t('По батькові')}
              value={values.MiddleName}
              onChange={(event) => update('MiddleName', event.currentTarget.value)}
            />
            <TextInput
              error={showErrors ? emailError : undefined}
              label={t('Email')}
              required
              value={values.Email}
              onChange={(event) => update('Email', event.currentTarget.value)}
            />
            <TextInput
              error={showErrors ? phoneError : undefined}
              label={t('Телефон')}
              required
              value={values.PhoneNumber}
              onChange={(event) => update('PhoneNumber', event.currentTarget.value)}
            />
            {!isEdit && (
              <PasswordInput
                label={t('Пароль')}
                value={values.Password}
                onChange={(event) => update('Password', event.currentTarget.value)}
              />
            )}

          </Card>
          <AppModalFooter>
            {onCancel && (
              <Button color="gray" disabled={disabled} variant="default" onClick={onCancel}>
                {t('Скасувати')}
              </Button>
            )}
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={disabled}
              leftSection={<Check size={16} />}
              onClick={handleSubmit}
            >
              {isEdit ? t('Зберегти') : t('Створити')}
            </Button>
          </AppModalFooter>
        </>
      )}
    </Stack>
  )
}
