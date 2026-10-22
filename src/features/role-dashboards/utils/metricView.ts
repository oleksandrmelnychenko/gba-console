import {
  Activity,
  AlarmClock,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileInput,
  FileOutput,
  FileWarning,
  Hourglass,
  Layers,
  MapPinOff,
  Package,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackageSearch,
  RefreshCcw,
  Scale,
  Send,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Undo2,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardWorkspaceMetric } from '../types'

// Keys are owned by the server (DashboardWorkspaceSummaryBuilder); unknown keys
// fall back to a neutral activity icon.
const METRIC_ICONS: Record<string, LucideIcon> = {
  'active-users': Users,
  assigned: UserCheck,
  'available-qty': Boxes,
  'awaiting-placement': PackageSearch,
  'cash-in': ArrowDownToLine,
  'cash-out': ArrowUpFromLine,
  'income-documents': FileInput,
  items: Layers,
  'missing-documents': FileWarning,
  'missing-placement-links': MapPinOff,
  'negative-stock': PackageMinus,
  'net-cash-flow': ArrowLeftRight,
  'open-debts': Wallet,
  'open-protocols': ClipboardList,
  'outcome-documents': FileOutput,
  'overdue-debts': CalendarClock,
  'overdue-orders': AlarmClock,
  'partially-placed': PackageOpen,
  pending: Hourglass,
  qty: Package,
  'receipt-qty': PackageCheck,
  receipts: PackageCheck,
  'reconciliation-differences': Scale,
  returns: Undo2,
  sales: ShoppingCart,
  sent: Send,
  'shipped-invoices': Truck,
  'sold-qty': ShoppingBag,
  'sync-runs': RefreshCcw,
  transfers: ArrowRightLeft,
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
const countFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

export function getMetricIcon(metric: DashboardWorkspaceMetric): LucideIcon {
  return METRIC_ICONS[metric.key] ?? Activity
}

export function isMoneyMetric(metric: DashboardWorkspaceMetric): boolean {
  return metric.unit === 'EUR' || metric.unit === 'UAH'
}

export function formatMetricValue(metric: DashboardWorkspaceMetric): { unit: string; value: string } {
  if (!metric.hasData) {
    return { unit: '', value: 'Немає даних' }
  }

  if (isMoneyMetric(metric)) {
    return { unit: metric.unit, value: moneyFormatter.format(metric.value) }
  }

  if (metric.unit === '%') {
    return { unit: '%', value: qtyFormatter.format(metric.value) }
  }

  return {
    unit: '',
    value: (metric.unit === 'qty' ? qtyFormatter : countFormatter).format(metric.value),
  }
}

/** Metrics that signal a problem: a warning/critical tone with a non-zero value. */
export function isAttentionMetric(metric: DashboardWorkspaceMetric): boolean {
  return metric.hasData && metric.value !== 0 && (metric.tone === 'critical' || metric.tone === 'warning')
}
