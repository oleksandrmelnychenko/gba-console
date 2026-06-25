import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { IconAlertCircle, IconPlus } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  createClientResourcePerfectClient,
  getClientResourcePerfectClients,
} from '../../api/clientLookupsApi'
import type { ClientResourcePerfectClient } from '../../../client-resources/types'
import { PerfectClientType } from '../../types'
import type { Client, ClientPerfectClientValue, PerfectClient } from '../../types'

const PERFECT_CLIENT_CULTURE = 'uk'
const PERFECT_CLIENT_TRANSLATION_CULTURE = 'pl'

export type PerfectClientPanelProps = {
  client: Client
  onChange: (client: Client) => void
}

type PerfectClientFormValues = {
  Name: string
  TranslationName: string
  Lable: string
  Description: string
  Type: string
  Value: string
  ToggleValueLeft: string
  ToggleValueLeftTranslation: string
  ToggleValueRight: string
  ToggleValueRightTranslation: string
}

function getRoleId(client: Client): number | undefined {
  return client.ClientInRole?.ClientTypeRole?.Id
}

function getKey(perfectClient: PerfectClient, index: number): string {
  return perfectClient.NetUid || (perfectClient.Id ? `id-${perfectClient.Id}` : `index-${index}`)
}

function isSameDefinition(left: PerfectClient, right: PerfectClient): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (typeof left.Id === 'number' && typeof right.Id === 'number' && left.Id > 0 && right.Id > 0) {
    return left.Id === right.Id
  }

  return false
}

function mergePerfectClients(definitions: PerfectClient[], existing: PerfectClient[]): PerfectClient[] {
  const merged = definitions.map((definition) => {
    const saved = existing.find((item) => isSameDefinition(definition, item))

    if (!saved) {
      return definition
    }

    return {
      ...definition,
      IsSelected: saved.IsSelected,
      Value: saved.Value,
      Values: (definition.Values || []).map((value, index) => ({
        ...value,
        IsSelected: saved.Values?.[index]?.IsSelected ?? value.IsSelected,
      })),
    }
  })

  const orphans = existing.filter((saved) => !definitions.some((definition) => isSameDefinition(definition, saved)))

  return [...merged, ...orphans]
}

function createEmptyFormValues(): PerfectClientFormValues {
  return {
    Name: '',
    TranslationName: '',
    Lable: '',
    Description: '',
    Type: String(PerfectClientType.Toggle),
    Value: '',
    ToggleValueLeft: '',
    ToggleValueLeftTranslation: '',
    ToggleValueRight: '',
    ToggleValueRightTranslation: '',
  }
}

function buildNewPerfectClientPayload(values: PerfectClientFormValues, roleId: number): ClientResourcePerfectClient {
  const name = values.Name.trim()
  const translationName = values.TranslationName.trim()
  const type = Number(values.Type || PerfectClientType.Toggle)
  const isToggle = type === PerfectClientType.Toggle

  return {
    ClientTypeRoleId: roleId,
    Name: name,
    Lable: values.Lable.trim(),
    Description: values.Description.trim(),
    Type: type,
    Value: isToggle ? '' : values.Value.trim(),
    PerfectClientTranslations: [
      { CultureCode: PERFECT_CLIENT_CULTURE, Name: name },
      { CultureCode: PERFECT_CLIENT_TRANSLATION_CULTURE, Name: translationName },
    ],
    Values: isToggle
      ? [
          {
            Value: values.ToggleValueLeft.trim(),
            PerfectClientValueTranslations: [
              { CultureCode: PERFECT_CLIENT_CULTURE, Value: values.ToggleValueLeft.trim() },
              { CultureCode: PERFECT_CLIENT_TRANSLATION_CULTURE, Value: values.ToggleValueLeftTranslation.trim() },
            ],
          },
          {
            Value: values.ToggleValueRight.trim(),
            PerfectClientValueTranslations: [
              { CultureCode: PERFECT_CLIENT_CULTURE, Value: values.ToggleValueRight.trim() },
              { CultureCode: PERFECT_CLIENT_TRANSLATION_CULTURE, Value: values.ToggleValueRightTranslation.trim() },
            ],
          },
        ]
      : [],
  }
}

export function PerfectClientPanel({ client, onChange }: PerfectClientPanelProps) {
  const { t } = useI18n()
  const roleId = getRoleId(client)
  const [perfectClients, setPerfectClients] = useValueState<PerfectClient[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [addModalOpened, setAddModalOpened] = useValueState(false)
  const [isAdding, setAdding] = useValueState(false)
  const [addError, setAddError] = useValueState<string | null>(null)
  const existingPerfectClientsRef = useRef(client.PerfectClients)

  useEffect(() => {
    existingPerfectClientsRef.current = client.PerfectClients
  }, [client.PerfectClients])

  useEffect(() => {
    let cancelled = false

    async function loadDefinitions(id: number) {
      setLoading(true)
      setError(null)

      try {
        const definitions = await getClientResourcePerfectClients(id)

        if (!cancelled) {
          setPerfectClients(
            mergePerfectClients(definitions as unknown as PerfectClient[], existingPerfectClientsRef.current || []),
          )
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити ідеального клієнта'))
          setPerfectClients([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (roleId) {
      void loadDefinitions(roleId)
    }

    return () => {
      cancelled = true
    }
  }, [roleId, setPerfectClients, setLoading, setError, t])

  const checkboxClients = perfectClients.filter((item) => item.Type === PerfectClientType.Checkbox)
  const toggleClients = perfectClients.filter((item) => item.Type === PerfectClientType.Toggle)

  function commit(next: PerfectClient[]) {
    setPerfectClients(next)
    onChange({
      ...client,
      PerfectClients: next,
    })
  }

  function updateClientAt(target: PerfectClient, updater: (current: PerfectClient) => PerfectClient) {
    commit(perfectClients.map((item) => (item === target ? updater(item) : item)))
  }

  function handleCheckboxSelectedChange(target: PerfectClient, isSelected: boolean) {
    updateClientAt(target, (current) => ({ ...current, IsSelected: isSelected }))
  }

  function handleCheckboxValueChange(target: PerfectClient, value: string) {
    updateClientAt(target, (current) => ({ ...current, Value: value }))
  }

  function handleToggleSelectedChange(target: PerfectClient, isSelected: boolean) {
    updateClientAt(target, (current) => ({ ...current, IsSelected: isSelected }))
  }

  function handleToggleSideChange(target: PerfectClient) {
    updateClientAt(target, (current) => ({
      ...current,
      Values: (current.Values || []).map((value) => ({ ...value, IsSelected: !value.IsSelected })),
    }))
  }

  function handleToggleCommentChange(target: PerfectClient, value: string) {
    updateClientAt(target, (current) => ({ ...current, Value: value }))
  }

  async function handleAddPerfectClient(values: PerfectClientFormValues) {
    if (!roleId) {
      return
    }

    if (!values.Name.trim() || !values.TranslationName.trim()) {
      setAddError(t('Вкажіть назву параметра'))
      return
    }

    if (
      Number(values.Type) === PerfectClientType.Toggle
      && (
        !values.ToggleValueLeft.trim()
        || !values.ToggleValueLeftTranslation.trim()
        || !values.ToggleValueRight.trim()
        || !values.ToggleValueRightTranslation.trim()
      )
    ) {
      setAddError(t('Вкажіть обидва значення перемикача'))
      return
    }

    setAdding(true)
    setAddError(null)

    try {
      const created = await createClientResourcePerfectClient(buildNewPerfectClientPayload(values, roleId))

      if (created) {
        commit([...perfectClients, created as unknown as PerfectClient])
      }

      setAddModalOpened(false)
    } catch (createError) {
      setAddError(createError instanceof Error ? createError.message : t('Не вдалося створити параметр'))
    } finally {
      setAdding(false)
    }
  }

  function openAddModal() {
    setAddError(null)
    setAddModalOpened(true)
  }

  return (
    <>
      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t('Ідеальний клієнт')}</Text>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!roleId}
              leftSection={<IconPlus size={16} />}
              size="xs"
              variant="light"
              onClick={openAddModal}
            >
              {t('Додати параметр')}
            </Button>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="violet" size="sm" />
              <Text c="dimmed" size="sm">
                {t('Завантаження ідеального клієнта')}
              </Text>
            </Group>
          ) : perfectClients.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Параметрів не додано')}
            </Text>
          ) : (
            <Box
              style={{
                maxHeight: 'calc(100vh - 320px)',
                overflowX: 'hidden',
                overflowY: 'auto',
                paddingRight: 8,
              }}
            >
              <Grid gap="lg">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="sm">
                    {checkboxClients.map((perfectClient, index) => (
                      <CheckboxRow
                        key={getKey(perfectClient, index)}
                        perfectClient={perfectClient}
                        onSelectedChange={(isSelected) => handleCheckboxSelectedChange(perfectClient, isSelected)}
                        onValueChange={(value) => handleCheckboxValueChange(perfectClient, value)}
                      />
                    ))}
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="sm">
                    {toggleClients.map((perfectClient, index) => (
                      <ToggleRow
                        key={getKey(perfectClient, index)}
                        perfectClient={perfectClient}
                        onCommentChange={(value) => handleToggleCommentChange(perfectClient, value)}
                        onSelectedChange={(isSelected) => handleToggleSelectedChange(perfectClient, isSelected)}
                        onSideChange={() => handleToggleSideChange(perfectClient)}
                      />
                    ))}
                  </Stack>
                </Grid.Col>
              </Grid>
            </Box>
          )}
        </Stack>
      </Card>

      <PerfectClientAddModal
        error={addError}
        isSaving={isAdding}
        opened={addModalOpened}
        onClose={() => setAddModalOpened(false)}
        onSave={handleAddPerfectClient}
      />
    </>
  )
}

function CheckboxRow({
  perfectClient,
  onSelectedChange,
  onValueChange,
}: {
  perfectClient: PerfectClient
  onSelectedChange: (isSelected: boolean) => void
  onValueChange: (value: string) => void
}) {
  const isSelected = Boolean(perfectClient.IsSelected)

  return (
    <Card withBorder padding="sm" radius="md">
      <Stack gap="xs">
        <Checkbox
          checked={isSelected}
          color="violet"
          label={perfectClient.Lable}
          onChange={(event) => onSelectedChange(event.currentTarget.checked)}
        />
        <TextInput
          disabled={!isSelected}
          value={perfectClient.Value || ''}
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
      </Stack>
    </Card>
  )
}

function ToggleRow({
  perfectClient,
  onCommentChange,
  onSelectedChange,
  onSideChange,
}: {
  perfectClient: PerfectClient
  onCommentChange: (value: string) => void
  onSelectedChange: (isSelected: boolean) => void
  onSideChange: () => void
}) {
  const isSelected = Boolean(perfectClient.IsSelected)
  const values: ClientPerfectClientValue[] = perfectClient.Values || []
  const leftValue = values[0]
  const rightValue = values[1]
  const isRightSelected = !leftValue?.IsSelected

  return (
    <Card withBorder padding="sm" radius="md">
      <Stack gap="xs">
        <Checkbox
          checked={isSelected}
          color="violet"
          label={perfectClient.Lable}
          onChange={(event) => onSelectedChange(event.currentTarget.checked)}
        />
        <Group gap="sm" align="center" wrap="nowrap">
          <Text c={isRightSelected ? 'dimmed' : undefined} size="sm">
            {leftValue?.Value}
          </Text>
          <Switch
            checked={isRightSelected}
            color="violet"
            disabled={!isSelected}
            onChange={onSideChange}
          />
          <Text c={isRightSelected ? undefined : 'dimmed'} size="sm">
            {rightValue?.Value}
          </Text>
        </Group>
        <Textarea
          autosize
          disabled={!isSelected}
          minRows={2}
          value={perfectClient.Value || ''}
          onChange={(event) => onCommentChange(event.currentTarget.value)}
        />
      </Stack>
    </Card>
  )
}

function PerfectClientAddModal({
  error,
  isSaving,
  opened,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  onClose: () => void
  onSave: (values: PerfectClientFormValues) => void
}) {
  const { t } = useI18n()
  const [values, setValues] = useValueState<PerfectClientFormValues>(() => createEmptyFormValues())
  const [wasOpened, setWasOpened] = useValueState(opened)

  if (opened !== wasOpened) {
    setWasOpened(opened)

    if (opened) {
      setValues(createEmptyFormValues())
    }
  }

  function setField<K extends keyof PerfectClientFormValues>(key: K, value: PerfectClientFormValues[K]) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const isToggle = Number(values.Type) === PerfectClientType.Toggle

  return (
    <AppModal centered opened={opened} title={t('Новий параметр ідеального клієнта')} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <TextInput
            autoFocus
            label={t('Назва')}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={t('Переклад')}
            required
            value={values.TranslationName}
            onChange={(event) => setField('TranslationName', event.currentTarget.value)}
          />
          <Select
            allowDeselect={false}
            data={[
              { value: String(PerfectClientType.Checkbox), label: t('Прапорець') },
              { value: String(PerfectClientType.Toggle), label: t('Перемикач') },
            ]}
            label={t('Тип')}
            value={values.Type}
            onChange={(value) => setField('Type', value || String(PerfectClientType.Toggle))}
          />
          <TextInput
            label={t('Мітка')}
            value={values.Lable}
            onChange={(event) => setField('Lable', event.currentTarget.value)}
          />
          <Textarea
            autosize
            label={t('Опис')}
            minRows={2}
            value={values.Description}
            onChange={(event) => setField('Description', event.currentTarget.value)}
          />
          {isToggle ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label={t('Значення 1 (ліво)')}
                required
                value={values.ToggleValueLeft}
                onChange={(event) => setField('ToggleValueLeft', event.currentTarget.value)}
              />
              <TextInput
                label={t('Значення 1 (ліво-переклад)')}
                required
                value={values.ToggleValueLeftTranslation}
                onChange={(event) => setField('ToggleValueLeftTranslation', event.currentTarget.value)}
              />
              <TextInput
                label={t('Значення 2 (право)')}
                required
                value={values.ToggleValueRight}
                onChange={(event) => setField('ToggleValueRight', event.currentTarget.value)}
              />
              <TextInput
                label={t('Значення 2 (право-переклад)')}
                required
                value={values.ToggleValueRightTranslation}
                onChange={(event) => setField('ToggleValueRightTranslation', event.currentTarget.value)}
              />
            </SimpleGrid>
          ) : (
            <TextInput
              label={t('Значення')}
              value={values.Value}
              onChange={(event) => setField('Value', event.currentTarget.value)}
            />
          )}
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} type="submit">
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
