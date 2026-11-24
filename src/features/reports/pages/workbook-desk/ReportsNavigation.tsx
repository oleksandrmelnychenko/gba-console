import { Menu } from '@mantine/core'
import { CUSTOMER_RETURN_WORKBOOK } from '../../data/customerReturnReport'
import { BarChart3, Boxes, ChevronDown, FileText, ShoppingCart, Wallet } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { PURCHASES_CONSTRUCTOR_FILE, STOCK_PERIOD_CONSTRUCTOR_FILE, type WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, SALES_CONSTRUCTOR_WORKBOOK } from '../../data/salesConstructorProfiles'
import { CASH_NAVIGATION, SALES_NAVIGATION, SPECIAL_NAVIGATION } from '../../data/reportNavigationEntries'
import { ReportHistoryNavigationButton } from './ReportHistoryNavigationButton'
import './reports-navigation.css'

type Props = {
  launches: readonly WorkbookLaunch[]
  active: string | null
  movement: boolean
  disabled: boolean
  onOpen: (launch: WorkbookLaunch) => void
  onStocks: () => void
  onSalesRegister?: () => void
  salesRegisterActive?: boolean
  historyActive?: boolean
}

const sales = SALES_NAVIGATION
const cash = CASH_NAVIGATION
const special = SPECIAL_NAVIGATION

export function ReportsNavigation({ launches, active, movement, disabled, onOpen, onStocks, onSalesRegister, salesRegisterActive = false, historyActive = false }: Props) {
  const { t } = useI18n()
  const activeSource = movement || historyActive ? null : launches.find(launch => launch.fileName === active)?.dataset.DataSource
  const stocks = launches.find(launch => launch.fileName === STOCK_PERIOD_CONSTRUCTOR_FILE)
  const purchases = launches.find(launch => launch.fileName === PURCHASES_CONSTRUCTOR_FILE)
  const unavailable = t('Звіт ще не доступний у поточному каталозі.')
  const pill = (selected: boolean) => `console-subnav-pill console-subnav-item${selected ? ' is-active' : ''}`
  function dropdown(label: string, Icon: typeof BarChart3, entries: readonly { label: string; file: string | null }[], selected: boolean) {
    return <Menu position="bottom-start" withinPortal shadow="md" radius="md" trigger="click-hover">
      <Menu.Target>
        <button type="button" className={pill(selected)} disabled={disabled} aria-pressed={selected}>
          <Icon size={16} aria-hidden="true" /><span>{t(label)}</span><ChevronDown size={14} aria-hidden="true" />
        </button>
      </Menu.Target>
      <Menu.Dropdown className="reports-navigation__dropdown">
        {entries.map(entry => {
          const launch = launches.find(item => item.fileName === entry.file)
          return <Menu.Item key={entry.label} disabled={disabled || !launch} title={!launch ? unavailable : undefined}
            aria-current={launch && launch.fileName === active && !movement ? 'page' : undefined}
            onClick={() => { if (launch && !disabled) onOpen(launch) }}>{t(entry.label)}</Menu.Item>
        })}
        {entries === sales && onSalesRegister && <Menu.Item disabled={disabled} onClick={onSalesRegister}>{t('Звірка продажів з 1С')}</Menu.Item>}
        {entries.some(entry => !launches.some(launch => launch.fileName === entry.file))
          ? <Menu.Label>{unavailable}</Menu.Label> : null}
      </Menu.Dropdown>
    </Menu>
  }
  return <nav className="reports-navigation" aria-label={t('Розділи звітів')}>
    <div className="console-subnav-row console-subnav-items reports-navigation__row">
      {dropdown('Продажі', BarChart3, sales, salesRegisterActive || active === SALES_CONSTRUCTOR_WORKBOOK || active === GROSS_PROFIT_CONSTRUCTOR_WORKBOOK || activeSource === 35 || activeSource === 38 || activeSource === 43)}
      <button type="button" className={pill(movement || activeSource === 45)} disabled={disabled} aria-pressed={movement || activeSource === 45}
        onClick={() => { if (stocks) onOpen(stocks); else onStocks() }}>
        <Boxes size={16} aria-hidden="true" /><span>{t('Залишки')}</span>
      </button>
      <button type="button" className={pill(activeSource === 3)} disabled={disabled || !purchases}
        aria-pressed={activeSource === 3} title={!purchases ? unavailable : undefined}
        onClick={() => { if (purchases && !disabled) onOpen(purchases) }}>
        <ShoppingCart size={16} aria-hidden="true" /><span>{t('Закупи')}</span>
      </button>
      {dropdown('Грошові кошти', Wallet, cash, activeSource === 40 || activeSource === 41)}
      {dropdown('Особливі звіти', FileText, special, activeSource === 39 || active === CUSTOMER_RETURN_WORKBOOK || activeSource === 44 || activeSource === 46)}
      <ReportHistoryNavigationButton className={pill(historyActive)} active={historyActive} disabled={disabled} />
    </div>
  </nav>
}
