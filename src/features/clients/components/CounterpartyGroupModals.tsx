import { Alert, Button, Select, Stack, Text, TextInput } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import type { CounterpartyGroupDraft, CounterpartyGroupNode } from '../api/counterpartyGroupsApi'
import { counterpartyGroupParentChoices, counterpartyGroupPath } from '../counterpartyGroupTree'

const MAXIMUM_NAME_LENGTH = 200
const MAXIMUM_REGION_CODE_LENGTH = 128

export function CounterpartyGroupFormModal({
  opened,
  groups,
  edited,
  parentNetUid,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  opened: boolean
  groups: readonly CounterpartyGroupNode[]
  edited: CounterpartyGroupNode | null
  parentNetUid: string | null
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: CounterpartyGroupDraft) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useValueState('')
  const [regionCode, setRegionCode] = useValueState('')
  const [parent, setParent] = useValueState<string | null>(null)
  const choices = useMemo(() => counterpartyGroupParentChoices(groups, edited?.NetUid), [edited?.NetUid, groups])

  useEffect(() => {
    if (!opened) return
    setName(edited?.Name ?? '')
    setRegionCode(edited?.RegionCode ?? '')
    setParent(edited ? edited.ParentNetUid : parentNetUid)
  }, [edited, opened, parentNetUid, setName, setParent, setRegionCode])

  const trimmedName = name.trim()
  const invalid = trimmedName.length === 0 || trimmedName.length > MAXIMUM_NAME_LENGTH
    || regionCode.trim().length > MAXIMUM_REGION_CODE_LENGTH

  return (
    <AppModal opened={opened} onClose={onClose} title={edited ? t('Змінити групу контрагентів') : t('Нова група контрагентів')}>
      <Stack gap="sm">
        {error ? <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert> : null}
        <TextInput
          data-autofocus
          label={t('Назва')}
          maxLength={MAXIMUM_NAME_LENGTH}
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Select
          clearable
          data={choices}
          label={t('Батьківська група')}
          nothingFoundMessage={t('Групу не знайдено')}
          placeholder={t('Верхній рівень довідника')}
          searchable
          value={parent}
          onChange={setParent}
        />
        <TextInput
          description={t('Для групи-мережі клієнтів, наприклад KH00. Такі групи показуються в списку клієнтів як папки.')}
          label={t('Код по регіону')}
          maxLength={MAXIMUM_REGION_CODE_LENGTH}
          value={regionCode}
          onChange={(event) => setRegionCode(event.currentTarget.value)}
        />
      </Stack>
      <AppModalFooter>
        <Button color="gray" variant="default" onClick={onClose}>{t('Скасувати')}</Button>
        <Button
          disabled={invalid}
          loading={saving}
          onClick={() => onSubmit({ ParentNetUid: parent, Name: trimmedName, RegionCode: regionCode.trim() || null })}
        >
          {t('Зберегти')}
        </Button>
      </AppModalFooter>
    </AppModal>
  )
}

export function CounterpartyGroupPickerModal({
  opened,
  groups,
  title,
  description,
  currentNetUid,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  opened: boolean
  groups: readonly CounterpartyGroupNode[]
  title: string
  description?: string
  currentNetUid?: string | null
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (groupNetUid: string) => void
}) {
  const { t } = useI18n()
  const [target, setTarget] = useValueState<string | null>(null)
  const choices = useMemo(() => groups
    .map((group) => ({ value: group.NetUid, label: counterpartyGroupPath(groups, group.NetUid) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'uk')), [groups])

  useEffect(() => {
    if (opened) setTarget(null)
  }, [opened, setTarget])

  return (
    <AppModal opened={opened} onClose={onClose} title={title}>
      <Stack gap="sm">
        {description ? <Text c="dimmed" size="sm">{description}</Text> : null}
        {error ? <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert> : null}
        <Select
          data={choices}
          data-autofocus
          label={t('Група контрагентів')}
          nothingFoundMessage={t('Групу не знайдено')}
          placeholder={t('Оберіть групу')}
          searchable
          value={target}
          onChange={setTarget}
        />
      </Stack>
      <AppModalFooter>
        <Button color="gray" variant="default" onClick={onClose}>{t('Скасувати')}</Button>
        <Button
          disabled={!target || target === currentNetUid}
          loading={saving}
          onClick={() => target && onSubmit(target)}
        >
          {t('Перемістити')}
        </Button>
      </AppModalFooter>
    </AppModal>
  )
}
