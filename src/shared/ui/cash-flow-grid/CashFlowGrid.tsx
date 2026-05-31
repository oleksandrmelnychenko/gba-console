import { type CSSProperties, type ReactNode, useMemo } from 'react'
import { Loader } from '@mantine/core'
import { useI18n } from '../../i18n/useI18n'
import type { TranslateFunction } from '../../i18n/types'
import type {
  CashFlowGridItem,
  CashFlowGridLabels,
  CashFlowGridLeadColumn,
  CashFlowGridProps,
} from './types'
import './cash-flow-grid.css'

const DEFAULT_COLUMN_WIDTH = 160

const defaultMoneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function CashFlowGrid<TItem extends CashFlowGridItem>({
  items,
  leadColumns,
  summary,
  labels: labelsOverride,
  columnWidth = DEFAULT_COLUMN_WIDTH,
  maxHeight = 450,
  isLoading = false,
  emptyText,
  loadingText,
  getRowKey,
  isRowActive,
  renderRowBadge,
  formatMoney,
  onRowClick,
  onSelectDebit,
  onSelectCredit,
}: CashFlowGridProps<TItem>) {
  const { t } = useI18n()
  const labels = useMemo(() => resolveLabels(t, labelsOverride), [labelsOverride, t])
  const money = formatMoney ?? defaultMoney
  const valueColumnStyle: CSSProperties = { flex: `0 0 ${columnWidth}px`, width: columnWidth }

  return (
    <div className="cfg-grid">
      <div className="cfg-row cfg-top">
        {leadColumns.map((column) => (
          <div key={column.id} className={leadCellClassName(column)} style={leadCellStyle(column, columnWidth)}>
            {column.topCell ?? column.header ?? null}
          </div>
        ))}
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <div className="cfg-sub">
            <span className="cfg-sub-note">({labels.income})</span> {labels.debit}
          </div>
          <div className="cfg-cell-value">{money(summary?.beforeInAmount)}</div>
        </div>
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <div className="cfg-sub">
            <span className="cfg-sub-note">({labels.outcome})</span> {labels.credit}
          </div>
          <div className="cfg-cell-value">{money(summary?.beforeOutAmount)}</div>
        </div>
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <div className="cfg-sub">{labels.balance}</div>
          <div className={valueClassName(summary?.beforeBalance)}>{money(summary?.beforeBalance)}</div>
        </div>
      </div>

      <div className="cfg-scroll" style={{ maxHeight }}>
        {isLoading ? (
          <div className="cfg-state">
            <Loader size="sm" /> {loadingText}
          </div>
        ) : items.length === 0 ? (
          <div className="cfg-state">{emptyText}</div>
        ) : (
          items.map((item, index) => {
            const isCredit = item.IsCreditValue === true

            return (
              <button
                type="button"
                key={getRowKey ? getRowKey(item, index) : index}
                className={dataRowClassName(isCredit, isRowActive?.(item, index) === true)}
                onClick={() => {
                  onRowClick?.(item, index)

                  if (isCredit) {
                    onSelectCredit?.(item, index)
                  } else {
                    onSelectDebit?.(item, index)
                  }
                }}
              >
                {leadColumns.map((column) => (
                  <div key={column.id} className={leadCellClassName(column)} style={leadCellStyle(column, columnWidth)}>
                    {column.isLabel ? renderRowBadge?.(item) : null}
                    <span className="cfg-cell-value cfg-label-name">{column.cell(item)}</span>
                  </div>
                ))}
                <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
                  <span className="cfg-cell-value">{isCredit ? '' : money(item.CurrentValue)}</span>
                </div>
                <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
                  <span className="cfg-cell-value">{isCredit ? money(item.CurrentValue) : ''}</span>
                </div>
                <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
                  <span className={valueClassName(item.CurrentBalance)}>{money(item.CurrentBalance)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="cfg-row cfg-bottom">
        {leadColumns.map((column, index) => (
          <div key={column.id} className={leadCellClassName(column)} style={leadCellStyle(column, columnWidth)}>
            {column.footCell ?? (index === 0 ? labels.bottomLine : null)}
          </div>
        ))}
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <span className="cfg-cell-value">{money(summary?.afterInAmount)}</span>
        </div>
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <span className="cfg-cell-value">{money(summary?.afterOutAmount)}</span>
        </div>
        <div className="cfg-cell cfg-align-right" style={valueColumnStyle}>
          <span className={valueClassName(summary?.closingBalance)}>{money(summary?.closingBalance)}</span>
        </div>
      </div>
    </div>
  )
}

function resolveLabels(t: TranslateFunction, overrides?: CashFlowGridLabels): Required<CashFlowGridLabels> {
  return {
    income: overrides?.income ?? t('Прихід'),
    outcome: overrides?.outcome ?? t('Розхід'),
    debit: overrides?.debit ?? t('Дебет'),
    credit: overrides?.credit ?? t('Кредит'),
    balance: overrides?.balance ?? t('Баланс'),
    bottomLine: overrides?.bottomLine ?? t('Підсумок'),
  }
}

function leadCellClassName<TItem extends CashFlowGridItem>(column: CashFlowGridLeadColumn<TItem>): string {
  const classNames = ['cfg-cell']

  if (column.isLabel) {
    classNames.push('cfg-label')
  }

  if (column.align === 'right') {
    classNames.push('cfg-align-right')
  } else if (column.align === 'center') {
    classNames.push('cfg-align-center')
  }

  return classNames.join(' ')
}

function leadCellStyle<TItem extends CashFlowGridItem>(
  column: CashFlowGridLeadColumn<TItem>,
  columnWidth: number,
): CSSProperties {
  if (column.isLabel && column.width === undefined) {
    return {}
  }

  const width = column.width ?? columnWidth

  return { flex: `0 0 ${typeof width === 'number' ? `${width}px` : width}`, width }
}

function dataRowClassName(isCredit: boolean, isActive: boolean): string {
  const classNames = ['cfg-row', 'cfg-data-row', isCredit ? 'cfg-credit' : 'cfg-debit']

  if (isActive) {
    classNames.push('cfg-active')
  }

  return classNames.join(' ')
}

function valueClassName(value?: number): string {
  if (value === undefined || value === null) {
    return 'cfg-cell-value'
  }

  return `cfg-cell-value ${value >= 0 ? 'cfg-positive' : 'cfg-negative'}`
}

function defaultMoney(value?: number): ReactNode {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return defaultMoneyFormatter.format(value)
}
