import { Alert, Button, Group, ScrollArea, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import type { TaxFreeCarrierPassport } from '../types'

type PassportDraft = {
  city: string
  houseNumber: string
  passportCloseDate: string
  passportIssuedBy: string
  passportIssuedDate: string
  passportNumber: string
  passportSeria: string
  street: string
}

export function TaxFreeCarrierPassportDrawer({
  opened,
  passport,
  onClose,
  onSubmit,
}: {
  opened: boolean
  passport: TaxFreeCarrierPassport | null
  onClose: () => void
  onSubmit: (passport: TaxFreeCarrierPassport) => void
}) {
  const { t } = useI18n()
  const isEditMode = Boolean(passport)
  const [draft, setDraft] = useValueState<PassportDraft>(() => toDraft(passport))
  const [error, setError] = useValueState<string | null>(null)

  function resetDraft() {
    setDraft(toDraft(passport))
    setError(null)
  }

  function updateDraft(patch: Partial<PassportDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleSubmit() {
    const validationError = validateDraft(draft, t)

    if (validationError) {
      setError(validationError)
      return
    }

    onSubmit({
      ...(passport || {}),
      City: draft.city.trim(),
      HouseNumber: draft.houseNumber.trim(),
      PassportCloseDate: draft.passportCloseDate || undefined,
      PassportIssuedBy: draft.passportIssuedBy.trim(),
      PassportIssuedDate: draft.passportIssuedDate || undefined,
      PassportNumber: draft.passportNumber.trim(),
      PassportSeria: draft.passportSeria.trim(),
      Street: draft.street.trim(),
    })
  }

  return (
    <AppDrawer
      opened={opened}
      size="lg"
      title={isEditMode ? t('Редагування Паспорту') : t('Новий Паспорт')}
      transitionProps={{ onEnter: resetDraft }}
      onClose={onClose}
    >
      <ScrollArea h="calc(100vh - 120px)" type="auto">
        <Stack gap="md" pr="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              label={t('Місто')}
              required
              value={draft.city}
              onChange={(event) => updateDraft({ city: event.currentTarget.value })}
            />
            <TextInput
              label={t('Вулиця')}
              required
              value={draft.street}
              onChange={(event) => updateDraft({ street: event.currentTarget.value })}
            />
            <TextInput
              label={t('Номер будинку')}
              required
              value={draft.houseNumber}
              onChange={(event) => updateDraft({ houseNumber: event.currentTarget.value })}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              label={t('Серія паспорту')}
              required
              value={draft.passportSeria}
              onChange={(event) => updateDraft({ passportSeria: event.currentTarget.value })}
            />
            <TextInput
              label={t('Номер паспорту')}
              required
              value={draft.passportNumber}
              onChange={(event) => updateDraft({ passportNumber: event.currentTarget.value })}
            />
            <TextInput
              label={t('Виданий')}
              required
              value={draft.passportIssuedBy}
              onChange={(event) => updateDraft({ passportIssuedBy: event.currentTarget.value })}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={t('Дійсний від')}
              type="date"
              value={draft.passportIssuedDate}
              onChange={(event) => updateDraft({ passportIssuedDate: event.currentTarget.value })}
            />
            <TextInput
              label={t('Дійсний до')}
              type="date"
              value={draft.passportCloseDate}
              onChange={(event) => updateDraft({ passportCloseDate: event.currentTarget.value })}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button color="gray" variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" onClick={handleSubmit}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </ScrollArea>
    </AppDrawer>
  )
}

function toDraft(passport: TaxFreeCarrierPassport | null): PassportDraft {
  const today = toDateInputValue(new Date())

  return {
    city: passport?.City || '',
    houseNumber: passport?.HouseNumber || '',
    passportCloseDate: passport ? toDateInputValue(passport.PassportCloseDate) : today,
    passportIssuedBy: passport?.PassportIssuedBy || '',
    passportIssuedDate: passport ? toDateInputValue(passport.PassportIssuedDate) : today,
    passportNumber: passport?.PassportNumber || '',
    passportSeria: passport?.PassportSeria || '',
    street: passport?.Street || '',
  }
}

function validateDraft(draft: PassportDraft, t: (value: string) => string): string | null {
  if (
    !draft.city.trim()
    || !draft.street.trim()
    || !draft.houseNumber.trim()
    || !draft.passportSeria.trim()
    || !draft.passportNumber.trim()
    || !draft.passportIssuedBy.trim()
  ) {
    return t('Помилки у формі')
  }

  return null
}

function toDateInputValue(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}
