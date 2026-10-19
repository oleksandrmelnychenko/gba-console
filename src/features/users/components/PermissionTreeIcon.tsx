import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Package,
  PanelsTopLeft,
  Pencil,
  Plug,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  ShoppingCart,
  Trash2,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

const SECTION_ICONS: Record<string, LucideIcon> = {
  administration: Settings2,
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  reports: BarChart3,
  integration: Plug,
  counterparties: Users,
  accounting: Calculator,
  payments: Wallet,
  services: BriefcaseBusiness,
  sales: ShoppingCart,
  warehouses: Warehouse,
  'warehouse-accounting': Boxes,
  warehouseAccounting: Boxes,
  products: Package,
}

const ACTION_ICONS = {
  Trash2, KeyRound, Plus, Pencil, Save, ArrowDownToLine, ArrowUpFromLine,
  Printer, RefreshCw, Eye, BadgeCheck, FileText,
}

function getActionIconName(key: string): keyof typeof ACTION_ICONS {
  const action = key.split('.').at(-1) || ''
  if (/synchronization|synchronisation/.test(key)) return 'RefreshCw'
  if (/delete|remove|archive/.test(action)) return 'Trash2'
  if (/password|credential/.test(action)) return 'KeyRound'
  if (/create|add|new/.test(action)) return 'Plus'
  if (/edit|update/.test(action)) return 'Pencil'
  if (/save/.test(action)) return 'Save'
  if (/export|download/.test(action)) return 'ArrowDownToLine'
  if (/import|upload/.test(action)) return 'ArrowUpFromLine'
  if (/print/.test(action)) return 'Printer'
  if (/sync|refresh|reload/.test(action)) return 'RefreshCw'
  if (/view|open|read/.test(action)) return 'Eye'
  if (/approve|confirm/.test(action)) return 'BadgeCheck'
  return 'FileText'
}

export function PermissionTreeIcon({ level, id }: {
  level: 'section' | 'page' | 'group' | 'action'
  id?: string
}) {
  const Icon = level === 'section' ? SECTION_ICONS[id || ''] || FolderOpen
    : level === 'page' ? PanelsTopLeft
      : level === 'group' ? ListTree
        : ACTION_ICONS[getActionIconName(id || '')]

  return (
    <span aria-hidden="true" className={`permission-tree-icon is-${level}`}>
      <Icon size={level === 'section' ? 19 : 17} strokeWidth={1.8} />
    </span>
  )
}
