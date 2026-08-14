import { Alert, Button, Group, Select, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { changeReconciliationDisposition } from '../api/actReconciliationsApi'
import {
  ActReconciliationDispositionReason,
  type ActReconciliationDispositionReasonCode,
  type ActReconciliationItem,
} from '../types'

export type ActReconciliationDispositionMode = 'dismiss' | 'reopen'

const REASON_OPTIONS: { value: ActReconciliationDispositionReasonCode; label: string }[] = [
  { value: ActReconciliationDispositionReason.TestData, label: 'Тестові дані' },
  { value: ActReconciliationDispositionReason.DataEntryError, label: 'Помилка введення в 1С' },
  { value: ActReconciliationDispositionReason.SourceCancelled, label: 'Документ скасовано в 1С' },
  { value: ActReconciliationDispositionReason.DuplicateDocument, label: 'Дублікат документа' },
  {
    value: ActReconciliationDispositionReason.BusinessAcceptedNoStockMovement,
    label: 'Підтверджено: залишки змінювати не потрібно',
  },
  { value: ActReconciliationDispositionReason.Other, label: 'Інша причина' },
]

const quantityFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 4,
})

export function ActReconciliationDispositionModal({
  actNetId,
  items,
  mode,
  opened,
  onApplied,
  onClose,
}: {
  actNetId: string
  items: ActReconciliationItem[]
  mode: ActReconciliationDispositionMode
  opened: boolean
  onApplied: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [reasonCode, setReasonCode] = useValueState<ActReconciliationDispositionReasonCode | null>(null)
  const [comment, setComment] = useValueState('')
  const [operationNetUid, setOperationNetUid] = useValueState('')
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [submitError, setSubmitError] = useValueState<string | null>(null)
  const itemKey = useMemo(
    () => items.map((item) => item.NetUid || item.Id).join(','),
    [items],
  )
  const differenceQty = useMemo(
    () => items.reduce((sum, item) => sum + Math.abs(item.QtyDifference || 0), 0),
    [items],
  )
  const isDismiss = mode === 'dismiss'
  const requiresComment = reasonCode === ActReconciliationDispositionReason.Other
  const canSubmit =
    Boolean(actNetId && operationNetUid && items.length > 0) &&
    (!isDismiss || Boolean(reasonCode)) &&
    (!requiresComment || Boolean(comment.trim())) &&
    !isSubmitting

  useEffect(() => {
    if (!opened) {
      return
    }

    setReasonCode(null)
    setComment('')
    setSubmitError(null)
    setSubmitting(false)
    const nextOperationNetUid = createOperationNetUid()

    setOperationNetUid(nextOperationNetUid || '')
    if (!nextOperationNetUid) {
      setSubmitError(t('Браузер не зміг створити захищений ідентифікатор операції. Оновіть сторінку або відкрийте її в сучасному браузері.'))
    }
  }, [itemKey, mode, opened, setComment, setOperationNetUid, setReasonCode, setSubmitError, setSubmitting, t])

  async function handleSubmit() {
    if (!canSubmit) {
      return
    }

    const itemNetIds = items.flatMap((item) => (item.NetUid ? [item.NetUid] : []))

    if (itemNetIds.length !== items.length) {
      setSubmitError(t('Не всі вибрані позиції мають системний ідентифікатор. Оновіть акт і повторіть.'))
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const result = await changeReconciliationDisposition({
        actNetId,
        comment,
        isDismissed: isDismiss,
        itemNetIds,
        operationNetUid,
        reasonCode: reasonCode || undefined,
      })
      const affectedCount = result.AffectedCount || items.length

      notifications.show({
        color: 'green',
        message: isDismiss
          ? `${t('Закрито без руху')}: ${affectedCount}`
          : `${t('Повернуто в роботу')}: ${affectedCount}`,
      })
      onApplied()
      onClose()
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t('Не вдалося зберегти рішення. Повторіть без зміни форми — ключ операції буде тим самим.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
      opened={opened}
      size="lg"
      title={isDismiss ? t('Закрити без руху товару') : t('Повернути в роботу')}
      onClose={onClose}
    >
      <Stack gap="md">
        <Alert color={isDismiss ? 'orange' : 'blue'} icon={<CircleAlert size={18} />} variant="light">
          {isDismiss
            ? t('Це рішення не створює прихід, переміщення або списання і не змінює залишки. Воно лише прибирає підтверджену службову/помилкову різницю з робочої черги.')
            : t('Позиції знову зʼявляться в робочій черзі. Після цього для них можна буде створити складський документ.')}
        </Alert>

        <Group gap="xl">
          <div>
            <Text c="dimmed" size="xs">{t('Позицій')}</Text>
            <Text fw={700}>{items.length}</Text>
          </div>
          <div>
            <Text c="dimmed" size="xs">{t('Сумарна різниця')}</Text>
            <Text fw={700}>{formatQuantity(differenceQty)}</Text>
          </div>
        </Group>

        {isDismiss && (
          <Select
            data={REASON_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            label={t('Чому складський рух не потрібен')}
            placeholder={t('Оберіть підтверджену причину')}
            required
            searchable
            value={reasonCode}
            onChange={(value) => setReasonCode(value as ActReconciliationDispositionReasonCode | null)}
          />
        )}

        <Textarea
          autosize
          label={isDismiss ? t('Пояснення') : t('Причина повернення')}
          maxLength={1000}
          minRows={3}
          placeholder={
            isDismiss
              ? t('Що перевірено в 1С і чому залишки не потрібно змінювати')
              : t('Що змінилося або що потрібно перевірити')
          }
          required={requiresComment}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
        />

        {submitError && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {submitError}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button color="gray" disabled={isSubmitting} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color={isDismiss ? 'orange' : CREATE_ACTION_COLOR}
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isDismiss ? t('Закрити без руху') : t('Повернути в роботу')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createOperationNetUid(): string | null {
  const operationNetUid = globalThis.crypto?.randomUUID?.()

  return operationNetUid || null
}

function formatQuantity(value: number): string {
  return quantityFormatter.format(value)
}
