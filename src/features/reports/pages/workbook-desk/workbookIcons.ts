import { ArrowLeftRight, ChartNoAxesCombined, PackageSearch, ReceiptText, Truck, WalletCards, type LucideIcon } from 'lucide-react'

const REPORT_ICONS: Record<number, LucideIcon> = {
  35: ChartNoAxesCombined, 38: Truck, 39: PackageSearch, 40: WalletCards, 41: ArrowLeftRight,
}

export function workbookIcon(fileName: string, dataSource: number): LucideIcon {
  return fileName === 'ДБіторка.xls' ? ReceiptText : REPORT_ICONS[dataSource] ?? ChartNoAxesCombined
}
