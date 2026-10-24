import { Button, Stack } from '@mantine/core'
import { FileSignature, Hash, Trash2 } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import type { SalesUkraineOrderItem } from '../../types'

/* Row-actions popup per docs/ui-patterns.md §7.1 for a cart row: mono title
   (code — name), subtle buttons with the icon in an outlined circle. */
export function CartRowActionsModal({
  isInvoice,
  item,
  onActEdit,
  onChangeQty,
  onClose,
  onRemove,
  zIndex,
}: {
  isInvoice: boolean
  item: SalesUkraineOrderItem | null
  onActEdit: () => void
  onChangeQty: (item: SalesUkraineOrderItem) => void
  onClose: () => void
  onRemove: (item: SalesUkraineOrderItem) => void
  zIndex?: number
}) {
  const { t } = useI18n()
  const code = item?.Product?.VendorCode || item?.Product?.Articul || ''
  const name = item?.Product?.NameUA || item?.Product?.Name || ''

  return (
    <AppModal
      centered
      zIndex={zIndex}
      opened={Boolean(item)}
      size={496}
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {[code, name].filter(Boolean).join(' — ') || t('Виберіть опцію')}
        </span>
      }
      onClose={onClose}
    >
      {item && (
        <Stack className="app-modal-actions" gap="xs">
          {isInvoice ? (
            /* Invoice rows are edited only through the edit act. */
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={
                <span className="app-action-icon">
                  <FileSignature size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              variant="subtle"
              onClick={onActEdit}
            >
              {t('Акт редагування накладної')}
            </Button>
          ) : (
            <>
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Hash size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                variant="subtle"
                onClick={() => onChangeQty(item)}
              >
                {t('Змінити кількість')}
              </Button>
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Trash2 size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                variant="subtle"
                onClick={() => onRemove(item)}
              >
                {t('Видалити')}
              </Button>
            </>
          )}
        </Stack>
      )}
    </AppModal>
  )
}
