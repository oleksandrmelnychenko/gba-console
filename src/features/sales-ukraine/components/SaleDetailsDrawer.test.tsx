import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineUpdateDataCarrier } from '../types'
import {
  CARRIER_HISTORY_CHANGED_FIELD,
  CarrierHistory,
  hasCarrierHistoryField,
} from './SaleDetailsDrawer'

const carrierHistoryCss = readFileSync(
  resolve(process.cwd(), 'src/features/sales-ukraine/components/sales-drawers.css'),
  'utf8',
)

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

afterEach(() => cleanup())

function entry(
  netUid: string,
  created: string,
  changedFields: number,
  values: Partial<SalesUkraineUpdateDataCarrier>,
): SalesUkraineUpdateDataCarrier {
  return {
    ChangedFields: changedFields,
    Created: created,
    HistoryFormatVersion: 1,
    NetUid: netUid,
    ...values,
  }
}

function historyCell(container: HTMLElement, field: string, column: string): HTMLTableCellElement {
  const cell = container.querySelector<HTMLTableCellElement>(
    `[data-history-field="${field}"][data-history-column="${column}"]`,
  )

  if (!cell) {
    throw new Error(`Missing history cell ${field}/${column}`)
  }

  return cell
}

describe('CarrierHistory', () => {
  it('renders after-state events and uses the persisted field mask for every column', () => {
    const entries: SalesUkraineUpdateDataCarrier[] = [
      entry(
        'event-1',
        '2026-07-11T19:02:45+03:00',
        CARRIER_HISTORY_CHANGED_FIELD.transporter | CARRIER_HISTORY_CHANGED_FIELD.mobilePhone,
        {
          MobilePhone: '455645454545',
          Transporter: { Id: 5, Name: 'Гюнсел' },
          User: { FirstName: 'First', LastName: 'User' },
        },
      ),
      entry(
        'event-2',
        '2026-07-11T19:02:59+03:00',
        CARRIER_HISTORY_CHANGED_FIELD.transporter,
        {
          MobilePhone: '455645454545',
          Transporter: { Id: 3, Name: 'Автолюкс' },
          User: { FirstName: 'Second', LastName: 'User' },
        },
      ),
      entry(
        'event-3',
        '2026-07-11T19:04:34+03:00',
        CARRIER_HISTORY_CHANGED_FIELD.city,
        { City: '7', MobilePhone: '455645454545', Transporter: { Id: 3, Name: 'Автолюкс' } },
      ),
    ]
    const current: SalesUkraineUpdateDataCarrier = {
      City: '7',
      MobilePhone: 'a-current-value-that-differs-but-was-not-in-the-latest-save',
      Transporter: { Id: 3, Name: 'Автолюкс' },
    }

    const { container } = render(
      <MantineProvider theme={theme}>
        <CarrierHistory current={current} entries={entries} />
      </MantineProvider>,
    )

    expect(historyCell(container, 'transporter', 'history-event-1').textContent).toContain('Гюнсел')
    expect(historyCell(container, 'mobilePhone', 'history-event-1').textContent).toContain('455645454545')
    expect(historyCell(container, 'transporter', 'history-event-1').classList).toContain('is-changed')
    expect(historyCell(container, 'mobilePhone', 'history-event-1').classList).toContain('is-changed')
    expect(historyCell(container, 'city', 'history-event-1').classList).not.toContain('is-changed')

    expect(historyCell(container, 'transporter', 'history-event-2').classList).toContain('is-changed')
    expect(historyCell(container, 'mobilePhone', 'history-event-2').classList).not.toContain('is-changed')
    expect(historyCell(container, 'responsible', 'history-event-2').classList).not.toContain('is-changed')
    expect(historyCell(container, 'city', 'history-event-3').classList).toContain('is-changed')

    expect(historyCell(container, 'city', 'current').classList).toContain('is-changed')
    expect(historyCell(container, 'transporter', 'current').classList).not.toContain('is-changed')
    expect(historyCell(container, 'mobilePhone', 'current').classList).not.toContain('is-changed')
    expect(historyCell(container, 'responsible', 'current').classList).not.toContain('is-changed')
  })

  it('reads combined server flags without comparing display labels', () => {
    const value = entry(
      'event',
      '2026-07-11T19:02:45+03:00',
      CARRIER_HISTORY_CHANGED_FIELD.transporter | CARRIER_HISTORY_CHANGED_FIELD.city,
      {},
    )

    expect(hasCarrierHistoryField(value, CARRIER_HISTORY_CHANGED_FIELD.transporter)).toBe(true)
    expect(hasCarrierHistoryField(value, CARRIER_HISTORY_CHANGED_FIELD.city)).toBe(true)
    expect(hasCarrierHistoryField(value, CARRIER_HISTORY_CHANGED_FIELD.mobilePhone)).toBe(false)
  })

  it('keeps red history highlighting stronger than striped and hover backgrounds', () => {
    expect(carrierHistoryCss).toContain(
      '.sales-drawer-table.sale-carrier-history-table .mantine-Table-tbody .mantine-Table-tr:nth-child(even) .mantine-Table-td.is-changed',
    )
    expect(carrierHistoryCss).toContain(
      '.sales-drawer-table.sale-carrier-history-table .mantine-Table-tbody .mantine-Table-tr:hover .mantine-Table-td.is-changed',
    )
    expect(carrierHistoryCss).toContain('background: var(--mantine-color-red-1)')
    expect(carrierHistoryCss).toContain('box-shadow: inset 3px 0 0 var(--mantine-color-red-6)')
  })
})
