import { CUSTOMER_RETURN_WORKBOOK } from '../../data/customerReturnReport'
import { Menu } from '@mantine/core'
import { BarChart3, Boxes, ChevronDown, FileText, ShoppingCart, Wallet } from 'lucide-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { PURCHASES_CONSTRUCTOR_FILE, type WorkbookLaunch } from '../../data/bug1274WorkbookLaunch'
import { GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, SALES_CONSTRUCTOR_WORKBOOK } from '../../data/salesConstructorProfiles'
import './reports-navigation.css'

type Props = {
  launches: readonly WorkbookLaunch[]
  active: string | null
  movement: boolean
  disabled: boolean
  onOpen: (launch: WorkbookLaunch) => void
  onStocks: () => void
}

const sales = [
  { label: 'Звіт по продажам', file: SALES_CONSTRUCTOR_WORKBOOK },
  { label: 'Валовий прибуток', file: GROSS_PROFIT_CONSTRUCTOR_WORKBOOK },
]
const cash = [
  { label: 'Відомість по коштах', file: 'Ведомость по денежным средствам.xls' },
  { label: 'Взаєморозрахунки всі', file: 'Взаємороз всі.xls' },
  { label: 'Дебіторська заборгованість', file: 'ДБіторка.xls' },
]
const special = [
  { label: 'Аналіз залишків і продажів', file: 'Впарювання.xls' },
  { label: 'Звіт повернення', file: CUSTOMER_RETURN_WORKBOOK },
  { label: 'Звіт по скидкам клієнтів', file: null },
  { label: 'Продажі порівнянням по групам цін', file: null },
  { label: 'Порівняння роботи клієнтів', file: null },
]

export function ReportsNavigation({ launches, active, movement, disabled, onOpen, onStocks }: Props) {
  const { t } = useI18n()
  const activeSource = movement ? null : launches.find(launch => launch.fileName === active)?.dataset.DataSource
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
        {entries.some(entry => !launches.some(launch => launch.fileName === entry.file))
          ? <Menu.Label>{unavailable}</Menu.Label> : null}
      </Menu.Dropdown>
    </Menu>
  }
  return <nav className="reports-navigation" aria-label={t('Розділи звітів')}>
    <div className="console-subnav-row console-subnav-items reports-navigation__row">
      {dropdown('Продажі', BarChart3, sales, activeSource === 2 || activeSource === 35 || activeSource === 38 || activeSource === 43)}
      <button type="button" className={pill(movement)} disabled={disabled} aria-pressed={movement} onClick={onStocks}>
        <Boxes size={16} aria-hidden="true" /><span>{t('Залишки')}</span>
      </button>
      <button type="button" className={pill(activeSource === 3)} disabled={disabled || !purchases}
        aria-pressed={activeSource === 3} title={!purchases ? unavailable : undefined}
        onClick={() => { if (purchases && !disabled) onOpen(purchases) }}>
        <ShoppingCart size={16} aria-hidden="true" /><span>{t('Закупи')}</span>
      </button>
      {dropdown('Грошові кошти', Wallet, cash, activeSource === 40 || activeSource === 41)}
      {dropdown('Особливі звіти', FileText, special, activeSource === 39 || active === CUSTOMER_RETURN_WORKBOOK)}
    </div>
  </nav>
}
