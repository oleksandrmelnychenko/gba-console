import { ActionIcon, Box } from '@mantine/core'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { SalesUkraineOrderItem } from '../../types'
import type { WizardSplitOrderItem } from './wizardSplitSale'
import type { WizardCartSelection } from './wizardCartMutation'
import { WizardCartEditTable } from './WizardCartEditTable'
import { getCurrentCartEditRows, getSplitCartEditRows } from './wizardCartEditModel'
export type { WizardCartSelection } from './wizardCartMutation'

export function EditShoppingCartOverlay({
  busy = false,
  currentItems,
  isSplit,
  onClose,
  selected,
  splitItems,
}: {
  busy?: boolean
  currentItems: SalesUkraineOrderItem[]
  isSplit: boolean
  onClose: () => void
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selectedList = selected?.list
  const selectedIndex = selected?.index
  useEffect(() => {
    if (selectedIndex == null) {
      return
    }

    const row = rootRef.current?.querySelector('.data-table-row.is-selected')
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedList, selectedIndex, currentItems, splitItems, isSplit])

  const currentRows = useMemo(() => getCurrentCartEditRows(currentItems), [currentItems])
  const splitRows = useMemo(() => getSplitCartEditRows(splitItems), [splitItems])

  return (
    <Box
      className="new-sale-cart-edit-overlay"
      ref={rootRef}
      aria-modal="true"
      aria-label={t('Редагування кошика')}
      role="dialog"
    >
      <Box className="new-sale-cart-edit-overlay__frame">
        <ActionIcon
          aria-label={t('Закрити')}
          className="new-sale-cart-edit-overlay__close"
          size={32}
          variant="subtle"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </ActionIcon>
        <Box className="new-sale-cart-edit-overlay__content">
          <WizardCartEditTable
            discountHeader={t('Ручна знижка')}
            list="current"
            rows={currentRows}
            selectedIndex={selected?.list === 'current' ? selected.index : null}
            title=""
          />
          {isSplit && (
            <WizardCartEditTable
              discountHeader={t('Знижка')}
              list="split"
              rows={splitRows}
              selectedIndex={selected?.list === 'split' ? selected.index : null}
              title={t('Нова накладна з рахунку')}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
