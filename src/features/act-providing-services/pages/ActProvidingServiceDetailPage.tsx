import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getActProvidingService,
  updateActProvidingService,
} from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel } from '../utils'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ActProvidingServiceDetailPage() {
  const model = useActProvidingServiceDetailModel()

  return <ActProvidingServiceDetailPageView model={model} />
}

function useActProvidingServiceDetailModel() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const [act, setAct] = useValueState<ActProvidingService | null>(null)
  const [comment, setComment] = useValueState('')
  const [fromDate, setFromDate] = useValueState('')
  const [isDirty, setDirty] = useValueState(false)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const requestRef = useRef(0)
  const displayModel = useMemo(() => (act ? toActProvidingServiceDisplayModel(act, t) : null), [act, t])

  const loadAct = useCallback(() => {
    if (!id) {
      setAct(null)
      setError(t('Акт надання послуг не вибрано'))
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    async function run(netId: string) {
      try {
        const loadedAct = await getActProvidingService(netId)

        if (requestRef.current !== requestId) {
          return
        }

        if (!loadedAct) {
          setAct(null)
          setError(t('Обраний акт надання послуг не існує'))
          return
        }

        setAct(loadedAct)
        setComment(loadedAct.Comment || '')
        setFromDate(toDateTimeLocal(loadedAct.FromDate))
        setDirty(false)
      } catch (loadError) {
        if (requestRef.current === requestId) {
          setAct(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акт надання послуг'))
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void run(id)
  }, [id, setAct, setComment, setDirty, setError, setFromDate, setLoading, t])

  useEffect(() => {
    loadAct()

    return () => {
      requestRef.current += 1
    }
  }, [loadAct])

  const updateComment = useCallback(
    (value: string) => {
      setComment(value)
      setDirty(true)
    },
    [setComment, setDirty],
  )
  const updateFromDate = useCallback(
    (value: string) => {
      setFromDate(value)
      setDirty(true)
    },
    [setDirty, setFromDate],
  )
  const save = useCallback(async () => {
    if (!act) {
      return
    }

    const nextDate = new Date(fromDate)

    if (!fromDate || Number.isNaN(nextDate.getTime())) {
      setError(t('Оберіть коректну дату акта'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const savedAct = await updateActProvidingService({
        ...act,
        Comment: comment,
        FromDate: nextDate.toISOString(),
      })

      if (!savedAct) {
        setError(t('Backend не повернув оновлений акт надання послуг'))
        return
      }

      setAct(savedAct)
      setComment(savedAct.Comment || '')
      setFromDate(toDateTimeLocal(savedAct.FromDate))
      setDirty(false)
      notifications.show({ color: 'green', message: t('Акт надання послуг оновлено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити акт надання послуг'))
    } finally {
      setSaving(false)
    }
  }, [act, comment, fromDate, setAct, setComment, setDirty, setError, setFromDate, setSaving, t])

  return {
    act,
    comment,
    displayModel,
    error,
    fromDate,
    isDirty,
    isLoading,
    isSaving,
    loadAct,
    save,
    updateComment,
    updateFromDate,
  }
}

function ActProvidingServiceDetailPageView({
  model,
}: {
  model: ReturnType<typeof useActProvidingServiceDetailModel>
}) {
  const { t } = useI18n()
  const {
    act,
    comment,
    displayModel,
    error,
    fromDate,
    isDirty,
    isLoading,
    isSaving,
    loadAct,
    save,
    updateComment,
    updateFromDate,
  } = model

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <Button component={Link} leftSection={<IconArrowLeft size={16} />} to="/act-providing-services" variant="light">
          {t('Назад')}
        </Button>
        <Group gap="xs">
          <Button color="gray" leftSection={<IconRefresh size={16} />} loading={isLoading} variant="light" onClick={loadAct}>
            {t('Оновити')}
          </Button>
          <Button
            disabled={!act || !isDirty}
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            onClick={save}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {displayModel ? (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Stack gap={4}>
                <Title order={3}>{t('Акт надання послуг')}</Title>
                <Text c="dimmed" size="sm">
                  {displayValue(displayModel.number)} · {formatDateTime(displayModel.date)}
                </Text>
              </Stack>
              <Badge color={displayModel.accountingMarker ? 'violet' : 'green'} size="lg" variant="light">
                {displayModel.accountingMarker ? t('Бухгалтерський') : t('Управлінський')}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
              <DetailValue label={t('Номер')} value={displayModel.number} />
              <DetailValue label={t('Організація')} value={displayModel.organization} />
              <DetailValue label={t('Постачальник послуг')} value={displayModel.serviceOrganization} />
              <DetailValue label={t('Договір')} value={displayModel.agreement} />
              <DetailValue label={t('Валюта')} value={displayModel.currency} />
              <DetailValue label={t('Дата інвойсу')} value={formatDateTime(displayModel.invDate)} />
              <DetailValue label={t('Номер інвойсу')} value={displayModel.invNumber} />
              <DetailValue label={t('Відповідальний')} value={displayModel.responsible} />
              <DetailValue label={t('Послуга')} value={displayModel.name} />
              <DetailValue label={t('Сума')} value={formatMoney(displayModel.amount)} />
              <DetailValue label={t('ПДВ %')} value={formatPercent(displayModel.percentVat)} />
              <DetailValue label={t('ПДВ')} value={formatMoney(displayModel.amountVat)} />
              <DetailValue label={t('Разом з ПДВ')} value={formatMoney(displayModel.totalWithVat)} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <TextInput
                label={t('Дата акта')}
                type="datetime-local"
                value={fromDate}
                onChange={(event) => updateFromDate(event.currentTarget.value)}
              />
              <Textarea
                autosize
                label={t('Коментар')}
                minRows={2}
                value={comment}
                onChange={(event) => updateComment(event.currentTarget.value)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      ) : (
        !isLoading && (
          <Card withBorder radius="md" padding="lg">
            <Text c="dimmed">{t('Акт надання послуг не знайдено')}</Text>
          </Card>
        )
      )}
    </Stack>
  )
}

function DetailValue({ label, value }: { label: string; value?: string | number }) {
  return (
    <Card withBorder radius="sm" padding="sm">
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={600} lineClamp={2} size="sm">
        {displayValue(value)}
      </Text>
    </Card>
  )
}

function toDateTimeLocal(value?: string): string {
  const date = value ? new Date(value) : new Date()

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return moneyFormatter.format(value)
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return `${value}%`
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
