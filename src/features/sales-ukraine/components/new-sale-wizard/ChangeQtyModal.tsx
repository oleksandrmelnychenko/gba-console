import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableChip } from '../../../../shared/ui/TableChip'
import { useWizardQuantityForm } from './useWizardQuantityForm'
import './change-qty-modal.css'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function ChangeQtyModal({
  availableQty,
  busy = false,
  initialComment,
  initialQty,
  opened,
  sessionKey,
  zIndex,
  onAccept,
  onCancel,
}: {
  availableQty: number
  busy?: boolean
  initialComment?: string
  initialQty?: number
  opened: boolean
  sessionKey?: string
  zIndex?: number
  onAccept: (qty: number, comment: string) => void | Promise<unknown>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const { value, comment, showError, setValue, setComment, confirm, cancel, handleKeyDown, isBusy } = useWizardQuantityForm({
    availableQty, initialQty, initialComment, onAccept, busy, opened, sessionKey, onCancel,
  })

  return (
    <AppModal
      centered
      className="new-sale-quantity-modal"
      size={420}
      opened={opened}
      zIndex={zIndex}
      title={t('Додати в кошик')}
      onClose={cancel}
      onKeyDown={handleKeyDown}
      closeOnEscape={false}
      closeOnClickOutside={!isBusy}
      closeButtonProps={{ disabled: isBusy }}
    >
      {opened && (
        <Stack className="app-compact-form" gap={10}>
          <div className="new-sale-quantity-modal__main">
            <Group gap={8} justify="center" className="new-sale-quantity-modal__available">
              <Text size="sm">{t('Доступно')}</Text>
              <TableChip tone={availableQty > 0 ? 'success' : 'neutral'} value={qtyFormatter.format(availableQty)} />
            </Group>
            <NumberInput
              className="new-sale-quantity-modal__quantity"
              allowNegative={false}
              autoFocus
              data-autofocus
              disabled={isBusy}
              decimalScale={3}
              error={showError ? t('Невірна кількість') : undefined}
              label={t('Кількість')}
              min={0}
              value={value}
              onChange={setValue}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>

          <TextInput
            disabled={isBusy}
            label={t('Коментар')}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />

          <AppModalFooter>
            <Button disabled={isBusy} variant="default" onClick={cancel}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} disabled={showError} loading={isBusy} onClick={confirm}>
              {t('Додати')}
            </Button>
          </AppModalFooter>
        </Stack>
      )}
    </AppModal>
  )
}
