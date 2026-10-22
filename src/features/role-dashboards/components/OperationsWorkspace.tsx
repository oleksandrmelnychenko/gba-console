import { Badge, Card, Skeleton, Text, UnstyledButton } from '@mantine/core'
import {
  ArrowRight,
  Banknote,
  Boxes,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  PackageCheck,
  ReceiptText,
  Route,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../navigation/navigationUtils'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { DashboardWorkspaceKey, DashboardWorkspaceMetric, DashboardWorkspaceSummary } from '../types'
import { formatMetricValue, isAttentionMetric } from '../utils/metricView'
import { MetricIcon } from './MetricIcon'
import { hasCompleteMetricCoverage, metricTimeLabel } from '../utils/metricScope'

type WorkspaceAction = {
  description: string
  icon: LucideIcon
  label: string
  route: string
}

const workspaceActions: Partial<Record<DashboardWorkspaceKey, WorkspaceAction[]>> = {
  logistics: [
    { description: 'Інвойси, документи доставки й терміни', icon: Truck, label: 'Замовлення на Україну', route: '/orders/ukraine/all' },
    { description: 'Відкриті та частково розміщені поставки', icon: ClipboardList, label: 'Протоколи поставок', route: '/product-delivery-protocols' },
    { description: 'Прийом товару від постачальників', icon: PackageCheck, label: 'Документи приходу', route: '/products/income/documents' },
    { description: 'Відвантаження зі складу', icon: FileCheck2, label: 'Складські накладні', route: '/warehouse/ukraine' },
  ],
  warehouse: [
    { description: 'Наявність за складами та партіями', icon: Boxes, label: 'Наявність товарів', route: '/products/consignments/availabilities' },
    { description: 'Накладні та відвантаження', icon: Boxes, label: 'Склад Україна', route: '/warehouse/ukraine' },
    { description: 'Комірки й лоти для прийнятого товару', icon: PackageCheck, label: 'Розміщення товарів', route: '/products/placements' },
    { description: 'Рух товару між складами й комірками', icon: Route, label: 'Переміщення товарів', route: '/products/transfers' },
    { description: 'Надходження товару на склад', icon: ClipboardList, label: 'Документи приходу', route: '/products/income/documents' },
    { description: 'Брак і повернення постачальникам', icon: ReceiptText, label: 'Повернення постачальнику', route: '/supplies/returns' },
  ],
  accounting: [
    { description: 'Надходження та прибуткові документи', icon: Banknote, label: 'Рух коштів', route: '/accounting/income-cashflows' },
    { description: 'Витрати й видаткові документи', icon: CircleDollarSign, label: 'Вихідні платежі', route: '/accounting/outgoing-cashflow' },
    { description: 'Розбіжності з контрагентами', icon: FileCheck2, label: 'Акти звірки', route: '/ukraine/act/reconcoliation' },
    { description: 'Платежі, що чекають розподілу', icon: ReceiptText, label: 'Доступні платежі', route: '/accounting/available-payments' },
  ],
  finance: [
    { description: 'Надходження та прибуткові документи', icon: Banknote, label: 'Рух коштів', route: '/accounting/income-cashflows' },
    { description: 'Витрати й видаткові документи', icon: CircleDollarSign, label: 'Вихідні платежі', route: '/accounting/outgoing-cashflow' },
    { description: 'Синхронізовані документи та сальдо', icon: ReceiptText, label: 'Баланси', route: '/accounting/sync/documents' },
    { description: 'Розбіжності з контрагентами', icon: FileCheck2, label: 'Акти звірки', route: '/ukraine/act/reconcoliation' },
  ],
  executive: [
    { description: 'Реалізації та повернення по Україні', icon: CircleDollarSign, label: 'Продажі', route: '/sales/ukraine/all' },
    { description: 'Попит, залишки й оборотність', icon: Boxes, label: 'Аналітика асортименту', route: '/products/assortment' },
    { description: 'Клієнтська база й заборгованість', icon: Users, label: 'Клієнти', route: '/clients' },
    { description: 'Замовлення на Україну', icon: Truck, label: 'Замовлення', route: '/orders/ukraine/all' },
  ],
  driver: [
    { description: 'Призначені й відправлені відвантаження', icon: Truck, label: 'Складські накладні', route: '/warehouse/ukraine' },
  ],
  client: [
    { description: 'Профіль і контрагенти', icon: Users, label: 'Клієнти', route: '/clients' },
    { description: 'Замовлення, позиції та документи', icon: ReceiptText, label: 'Продажі', route: '/sales/ukraine/all' },
  ],
}

const TONE_ORDER: Record<DashboardWorkspaceMetric['tone'], number> = {
  critical: 0,
  warning: 1,
  neutral: 2,
  positive: 3,
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const percentFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

export function OperationsWorkspace({
  error,
  summary,
  workspaceKey,
}: {
  error?: string | null
  summary: DashboardWorkspaceSummary | null
  workspaceKey: DashboardWorkspaceKey
}) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { modules } = useNavigation()
  const actions = useMemo(
    () => (workspaceActions[workspaceKey] ?? []).filter((action) => isNavigationPathAllowed(modules, action.route)),
    [modules, workspaceKey],
  )
  const metrics = summary?.metrics ?? []
  const attention = metrics
    .filter(isAttentionMetric)
    .toSorted((left, right) => TONE_ORDER[left.tone] - TONE_ORDER[right.tone] || Math.abs(right.value) - Math.abs(left.value))
  const cashIn = metrics.find((metric) => metric.key === 'cash-in' && metric.hasData)
  const cashOut = metrics.find((metric) => metric.key === 'cash-out' && metric.hasData)

  return (
    <div className="role-dashboard-ops">
      <Card className="app-section-card role-dashboard-operations" withBorder padding={0} radius="md">
        <div className="role-dashboard-section-head">
          <div className="role-dashboard-section-copy">
            <Text component="h2" className="app-section-title" fw={600}>{t('Реєстри')}</Text>
            <Text className="role-dashboard-section-subtitle">{t('Загальні реєстри. Їхні фільтри можуть відрізнятися від показників дашборда.')}</Text>
          </div>
        </div>
        <div className="role-dashboard-operations-body">
          {actions.length > 0 ? (
            <div className="role-dashboard-action-grid">
              {actions.map((action) => (
                <QueueAction
                  action={action}
                  key={action.route}
                  onOpen={() => navigate(action.route)}
                />
              ))}
            </div>
          ) : (
            <div className="role-dashboard-empty">
              <ShieldCheck aria-hidden="true" size={18} />
              <Text size="sm">{t('Немає доступних робочих черг')}</Text>
            </div>
          )}
        </div>
      </Card>

      <div className="role-dashboard-ops-rail">
        {cashIn && cashOut && (
          <CashFlowCard
            cashIn={cashIn}
            cashOut={cashOut}
            net={metrics.find((metric) => metric.key === 'net-cash-flow' && metric.hasData)}
          />
        )}

        <Card className="app-section-card role-dashboard-attention" withBorder padding={0} radius="md">
          <div className="role-dashboard-section-head">
            <div className="role-dashboard-section-copy">
              <Text component="h2" className="app-section-title" fw={600}>{t('Потребує уваги')}</Text>
              <Text className="role-dashboard-section-subtitle">{t('Поточний стан і події за період')}</Text>
            </div>
            {attention.length > 0 && (
              <Badge className={`app-role-pill ${attention[0].tone === 'critical' ? 'is-red' : 'is-orange'}`} variant="light">
                {attention.length}
              </Badge>
            )}
          </div>
          <div className="role-dashboard-attention-body">
            <AttentionStatus error={error} summary={summary} attention={attention} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function AttentionStatus({ error, summary, attention }: { error?: string | null; summary: DashboardWorkspaceSummary | null; attention: DashboardWorkspaceMetric[] }) {
  const { t } = useI18n()
  if (error) return <Text size="sm" c="orange">{t('Перевірку показників не завершено: помилка оновлення')}</Text>
  if (!summary) return <><Skeleton height={54} radius={8} /><Skeleton height={54} radius={8} /></>
  const complete = hasCompleteMetricCoverage(summary)
  if (attention.length === 0 && !complete) return <Text size="sm" c="orange">{t('Недостатньо даних для перевірки відхилень')}</Text>
  if (attention.length === 0) return (
    <div className="role-dashboard-attention-empty">
      <CircleCheck aria-hidden="true" size={20} />
      <div>
        <Text fw={650} size="sm">{t('Відхилень у доступних показниках немає')}</Text>
        <Text size="xs">{t('Перевірено лише наведені показники')}</Text>
      </div>
    </div>
  )
  return (
    <>
      {!complete && <Text size="sm" c="orange">{t('Частину показників не вдалося перевірити')}</Text>}
      {attention.map((metric) => <AttentionItem key={metric.key} metric={metric} />)}
    </>
  )
}

function QueueAction({
  action,
  onOpen,
}: {
  action: WorkspaceAction
  onOpen: () => void
}) {
  const { t } = useI18n()

  return (
    <UnstyledButton className="role-dashboard-action" onClick={onOpen}>
      <span aria-hidden="true" className="role-dashboard-action-icon"><action.icon size={18} /></span>
      <span className="role-dashboard-action-copy">
        <span className="role-dashboard-action-title">{t(action.label)}</span>
        <span className="role-dashboard-action-description">{t(action.description)}</span>
      </span>
      <ArrowRight aria-hidden="true" className="role-dashboard-action-arrow" size={17} />
    </UnstyledButton>
  )
}

function AttentionItem({ metric }: { metric: DashboardWorkspaceMetric }) {
  const { t } = useI18n()
  const formatted = formatMetricValue(metric)
  const content = (
    <>
      <span aria-hidden="true" className="role-dashboard-attention-icon"><MetricIcon metric={metric} size={16} /></span>
      <span className="role-dashboard-attention-label">{metric.label}<Text size="xs" c="dimmed">{t(metricTimeLabel(metric))}</Text></span>
      <span className="role-dashboard-attention-value">
        {formatted.value}
        {formatted.unit && <small>{formatted.unit}</small>}
      </span>
    </>
  )

  return (
    <div className={`role-dashboard-attention-item is-${metric.tone}`}>{content}</div>
  )
}

function CashFlowCard({
  cashIn,
  cashOut,
  net,
}: {
  cashIn: DashboardWorkspaceMetric
  cashOut: DashboardWorkspaceMetric
  net?: DashboardWorkspaceMetric
}) {
  const { t } = useI18n()
  const sameUnit = cashIn.unit === cashOut.unit
  const netValue = net?.value ?? (sameUnit ? cashIn.value - cashOut.value : null)
  const netUnit = net?.unit ?? cashIn.unit
  const scale = Math.max(Math.abs(cashIn.value), Math.abs(cashOut.value), 1)
  const rows = [
    { label: t('Надходження'), metric: cashIn, tone: 'in' },
    { label: t('Витрати'), metric: cashOut, tone: 'out' },
  ]

  return (
    <Card className="app-section-card role-dashboard-cash" withBorder padding={0} radius="md">
      <div className="role-dashboard-section-head">
        <div className="role-dashboard-section-copy">
          <Text component="h2" className="app-section-title" fw={600}>{t('Рух коштів')}</Text>
          <Text className="role-dashboard-section-subtitle">{t('Надходження проти витрат за період')}</Text>
        </div>
      </div>
      <div className="role-dashboard-cash-body">
        {rows.map((row) => (
          <div className={`role-dashboard-cash-row is-${row.tone}`} key={row.tone}>
            <div className="role-dashboard-cash-caption">
              <span>{row.label}</span>
              <b>{moneyFormatter.format(row.metric.value)} <small>{row.metric.unit}</small></b>
            </div>
            <div className="role-dashboard-cash-track" aria-hidden="true">
              <span style={{ width: `${(Math.abs(row.metric.value) / scale) * 100}%` }} />
            </div>
          </div>
        ))}
        {netValue !== null && (
          <div className={`role-dashboard-cash-net ${netValue < 0 ? 'is-negative' : 'is-positive'}`}>
            <span>{t('Чистий рух')}</span>
            <b>{netValue > 0 ? '+' : ''}{moneyFormatter.format(netValue)} <small>{netUnit}</small></b>
          </div>
        )}
        {sameUnit && cashIn.value > 0 && (
          <Text className="role-dashboard-cash-ratio">
            {t('Витрати становлять')} {percentFormatter.format((cashOut.value / cashIn.value) * 100)}% {t('від надходжень')}
          </Text>
        )}
      </div>
    </Card>
  )
}
