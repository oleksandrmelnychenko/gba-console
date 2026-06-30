import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
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

type ActProvidingServiceDetailState = {
  act: ActProvidingService | null
  comment: string
  error: string | null
  fromDate: string
  isDirty: boolean
  isLoading: boolean
  isSaving: boolean
}

const INITIAL_ACT_PROVIDING_SERVICE_DETAIL_STATE: ActProvidingServiceDetailState = {
  act: null,
  comment: '',
  error: null,
  fromDate: '',
  isDirty: false,
  isLoading: false,
  isSaving: false,
}

export type ActProvidingServiceDetailModel = ReturnType<typeof useActProvidingServiceDetailModel>

export function useActProvidingServiceDetailModel(id: string | undefined) {
  const { t } = useI18n()
  const [state, setState] = useValueState<ActProvidingServiceDetailState>(INITIAL_ACT_PROVIDING_SERVICE_DETAIL_STATE)
  const requestRef = useRef(0)
  const saveRequestRef = useRef(0)
  const { act, comment, error, fromDate, isDirty, isLoading, isSaving } = state
  const displayModel = useMemo(() => (act ? toActProvidingServiceDisplayModel(act, t) : null), [act, t])

  const loadAct = useCallback(() => {
    let isActive = true

    if (!id) {
      requestRef.current += 1
      setState((currentState) => ({
        ...currentState,
        act: null,
        error: t('Акт надання послуг не вибрано'),
        isLoading: false,
      }))
      return () => {
        isActive = false
      }
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setState((currentState) => ({ ...currentState, error: null, isLoading: true }))

    void getActProvidingService(id)
      .then((loadedAct) => {
        if (!isActive || requestRef.current !== requestId) {
          return
        }

        if (!loadedAct) {
          setState((currentState) => ({
            ...currentState,
            act: null,
            error: t('Обраний акт надання послуг не існує'),
            isLoading: false,
          }))
          return
        }

        setState((currentState) => ({
          ...currentState,
          act: loadedAct,
          comment: loadedAct.Comment || '',
          error: null,
          fromDate: toDateTimeLocal(loadedAct.FromDate),
          isDirty: false,
          isLoading: false,
        }))
      })
      .catch((loadError: unknown) => {
        if (isActive && requestRef.current === requestId) {
          setState((currentState) => ({
            ...currentState,
            act: null,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акт надання послуг'),
            isLoading: false,
          }))
        }
      })

    return () => {
      isActive = false
    }
  }, [id, setState, t])

  useEffect(() => {
    return loadAct()
  }, [loadAct])

  const updateComment = useCallback(
    (value: string) => {
      setState((currentState) => ({ ...currentState, comment: value, isDirty: true }))
    },
    [setState],
  )
  const updateFromDate = useCallback(
    (value: string) => {
      setState((currentState) => ({ ...currentState, fromDate: value, isDirty: true }))
    },
    [setState],
  )
  const save = useCallback(() => {
    if (!act) {
      return
    }

    const nextDate = new Date(fromDate)

    if (!fromDate || Number.isNaN(nextDate.getTime())) {
      setState((currentState) => ({ ...currentState, error: t('Оберіть коректну дату акта') }))
      return
    }

    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    setState((currentState) => ({ ...currentState, error: null, isSaving: true }))

    void updateActProvidingService({
      ...act,
      Comment: comment,
      FromDate: nextDate.toISOString(),
    })
      .then((savedAct) => {
        if (saveRequestRef.current !== requestId) {
          return
        }

        if (!savedAct) {
          setState((currentState) => ({
            ...currentState,
            error: t('Backend не повернув оновлений акт надання послуг'),
            isSaving: false,
          }))
          return
        }

        setState((currentState) => ({
          ...currentState,
          act: savedAct,
          comment: savedAct.Comment || '',
          error: null,
          fromDate: toDateTimeLocal(savedAct.FromDate),
          isDirty: false,
          isSaving: false,
        }))
        notifications.show({ color: 'green', message: t('Акт надання послуг оновлено') })
      })
      .catch((saveError: unknown) => {
        if (saveRequestRef.current === requestId) {
          setState((currentState) => ({
            ...currentState,
            error: saveError instanceof Error ? saveError.message : t('Не вдалося оновити акт надання послуг'),
            isSaving: false,
          }))
        }
      })
  }, [act, comment, fromDate, setState, t])

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

export function ActProvidingServiceDetailBody({ model }: { model: ActProvidingServiceDetailModel }) {
  const { t } = useI18n()
  const {
    comment,
    displayModel,
    error,
    fromDate,
    isLoading,
    isSaving,
    updateComment,
    updateFromDate,
  } = model

  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {displayModel ? (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
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
              <DetailValue label={t('Відповідальний')} value={displayModel.actResponsible} />
              <DetailValue label={t('Послуга')} value={displayModel.name} />
              <DetailValue label={t('Сума')} value={formatMoney(displayModel.amount)} />
              <DetailValue label={t('ПДВ %')} value={formatPercent(displayModel.percentVat)} />
              <DetailValue label={t('ПДВ')} value={formatMoney(displayModel.amountVat)} />
              <DetailValue label={t('Разом з ПДВ')} value={formatMoney(displayModel.totalWithVat)} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Дата акта')}
                type="datetime-local"
                value={fromDate}
                onChange={(event) => updateFromDate(event.currentTarget.value)}
              />
              <Textarea
                autosize
                disabled={isLoading || isSaving}
                label={t('Коментар')}
                minRows={2}
                value={comment}
                onChange={(event) => updateComment(event.currentTarget.value)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      ) : isLoading ? (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        </Card>
      ) : (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Text c="dimmed">{t('Акт надання послуг не знайдено')}</Text>
        </Card>
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
