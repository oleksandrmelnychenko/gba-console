import { Activity, Archive, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Award, BadgePercent, Banknote, Book, BookUser, Bookmark, Box, Boxes, Building, Building2, Bus, Calculator, Calendar, CalendarDays, Car, ChartBar, ChartLine, ChartPie, CircleAlert, CircleHelp, ClipboardCheck, ClipboardList, Clock, Cloud, Code, Coins, Compass, Database, Diamond, DollarSign, Factory, FileInput, FileOutput, FileText, Flag, Folder, Forklift, Globe, Hash, Hexagon, History, IdCard, Key, Landmark, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, Leaf, List, ListChecks, Lock, Mail, Map, MapPin, Megaphone, MessageCircle, NotebookText, Package, PackagePlus, Palette, Phone, Plug, Plus, Printer, Receipt, ReceiptText, RefreshCw, Rocket, Route, Scale, ScrollText, Search, Settings, Shield, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Star, Store, Tag, Tags, Target, TrendingDown, TrendingUp, TriangleAlert, Truck, User, UserCheck, UserCog, UserPlus, Users, Wallet, Warehouse, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

type IconComponent = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>

const iconRules: { match: RegExp; icon: IconComponent }[] = [
  { match: /дашборд|головна|робоч.*простір/i, icon: LayoutDashboard },

  { match: /клієнт.онлайн|онлайн.?магазин/i, icon: ShoppingBag },
  { match: /нов.*клієнт|створ.*клієнт|клієнт.*створ/i, icon: UserPlus },
  { match: /редагуванн.*клієнт|клієнт.*редагуванн/i, icon: UserCheck },
  { match: /реєстр.*клієнт|клієнт|контрагент/i, icon: Users },
  { match: /виробник|фабрик|завод|manufactur/i, icon: Factory },
  { match: /постачальник/i, icon: Truck },
  { match: /постачанн/i, icon: Truck },
  { match: /відванта|відгрузк|логістик/i, icon: Forklift },
  { match: /доставк|delivery/i, icon: PackagePlus },

  { match: /залишк|інвентар/i, icon: Layers },
  { match: /склад|warehouse/i, icon: Warehouse },

  { match: /маршрут/i, icon: Route },
  { match: /карт.|геолок|місцезнах/i, icon: Map },
  { match: /адрес/i, icon: MapPin },
  { match: /регіон|country|країн/i, icon: Globe },
  { match: /філі|відділенн|підрозділ/i, icon: Building2 },
  { match: /офіс|будівл|приміщенн/i, icon: Building },

  { match: /дозвіл|право доступ|permission/i, icon: Shield },
  { match: /безпек|пароль|security/i, icon: Lock },
  { match: /рол.|role/i, icon: Key },
  { match: /адмін|admin/i, icon: UserCog },
  { match: /верифікац|підтверджен|verif/i, icon: ShieldCheck },
  { match: /сертифікат|ліцензі|certificate/i, icon: IdCard },

  { match: /кошик|корзин/i, icon: ShoppingCart },

  { match: /повернен/i, icon: ReceiptText },
  { match: /прихідн|оприходуванн|надходженн/i, icon: ArrowDownToLine },
  { match: /видатков|видач/i, icon: ArrowUpFromLine },
  { match: /переміщ/i, icon: ArrowLeftRight },
  { match: /акт.*звірк|звірк|ревізі/i, icon: ClipboardCheck },
  { match: /акт.*списанн|акт.*оприход|акт.?/i, icon: ListChecks },
  { match: /списанн/i, icon: Receipt },

  { match: /взаєморозрахунк|розрахунк|дебіторк|кредиторк/i, icon: Scale },
  { match: /нез.ясован|невідом|невизначен/i, icon: CircleHelp },

  { match: /експорт|export|вигрузк|вивантаженн/i, icon: FileOutput },
  { match: /імпорт|import|завантаженн.?файл|загрузк/i, icon: FileInput },
  { match: /договір|контракт|угод/i, icon: FileText },
  { match: /накладн|рахунок-факт|інвойс/i, icon: ReceiptText },
  { match: /рахунк/i, icon: ReceiptText },
  { match: /чек|квитанц/i, icon: Receipt },
  { match: /шаблон|template/i, icon: LayoutTemplate },
  { match: /прим.рк|copy|друк/i, icon: Printer },
  { match: /документ/i, icon: FileText },
  { match: /файл|папк|folder|file/i, icon: Folder },
  { match: /нотатк|note|комент/i, icon: NotebookText },
  { match: /журнал|protocol|протокол/i, icon: Book },
  { match: /скрипт|формул|вираз/i, icon: ScrollText },

  { match: /податк|акциз|tax/i, icon: ReceiptText },
  { match: /зарплат/i, icon: ReceiptText },
  { match: /виплат|оплат|платіж/i, icon: Banknote },
  { match: /касов|каса/i, icon: Banknote },
  { match: /банк/i, icon: Landmark },
  { match: /ордер/i, icon: ClipboardList },
  { match: /грош|кошт|готівк|бюджет/i, icon: Wallet },
  { match: /курс|валют/i, icon: DollarSign },
  { match: /монет|coin/i, icon: Coins },
  { match: /калькулят|обчисл|розрахун.*цін/i, icon: Calculator },
  { match: /прибут|дохід|profit|revenue/i, icon: TrendingUp },
  { match: /збитк|витрат|loss|expense/i, icon: TrendingDown },
  { match: /брак|дефект|defect|псуван/i, icon: TriangleAlert },

  { match: /авто|машин|транспорт|vehicle|car/i, icon: Car },
  { match: /автобус|bus|перевезен/i, icon: Bus },
  { match: /замовлен|заявк|order/i, icon: ClipboardList },

  { match: /товар|номенклатур|продукт|product/i, icon: Package },
  { match: /категорі|групи|групп|category/i, icon: LayoutGrid },
  { match: /колекці|серії/i, icon: Boxes },
  { match: /пакет/i, icon: Box },
  { match: /магазин|торгов|shop/i, icon: Store },
  { match: /продаж|sale/i, icon: Tag },
  { match: /знижк|discount/i, icon: BadgePercent },
  { match: /акці.|прайс/i, icon: Tags },
  { match: /бонус|лояльн|нагород|award/i, icon: Award },
  { match: /промо|маркетинг|реклам/i, icon: Megaphone },
  { match: /дизайн|оформленн|стил/i, icon: Palette },

  { match: /звіт|report/i, icon: FileText },
  { match: /аналітик|статист/i, icon: ChartBar },
  { match: /прогноз|forecast|тренд|trend/i, icon: ChartLine },
  { match: /діаграм|graf|графік(?!.*раб|.*роб)/i, icon: ChartPie },

  { match: /синхр/i, icon: RefreshCw },
  { match: /база.?дан|database/i, icon: Database },
  { match: /інтеграц|api|підключенн|integration/i, icon: Plug },
  { match: /розробк|разработ|developer|code/i, icon: Code },
  { match: /архів/i, icon: Archive },
  { match: /історі|history|log/i, icon: History },

  { match: /кален|розклад|schedule/i, icon: Calendar },
  { match: /таймлайн|період|план|year|місяц|тижд/i, icon: CalendarDays },
  { match: /час|таймер|годин/i, icon: Clock },

  { match: /email|e-mail|пошт|mail/i, icon: Mail },
  { match: /телефон|дзвінк|phone|call/i, icon: Phone },
  { match: /чат|messag|повідомленн.*чат|sms/i, icon: MessageCircle },
  { match: /контакт|address.?book/i, icon: BookUser },

  { match: /пошук|search|фільтр/i, icon: Search },
  { match: /налаштуванн|параметр|конфіг|setting/i, icon: Settings },
  { match: /контроль|регулюванн/i, icon: SlidersHorizontal },
  { match: /моніторинг|статус|стан/i, icon: Activity },
  { match: /сповіщенн|повідомленн|нотифікац|alert/i, icon: CircleAlert },

  { match: /кадр|hr|персонал|відділ.*кадр/i, icon: Users },
  { match: /реєстр|перелік|список|каталог/i, icon: List },

  { match: /користувач|user|працівник|співробітник|employee/i, icon: User },
  { match: /обмін|exchange/i, icon: ArrowLeftRight },

  { match: /нов.|створ|new|add/i, icon: Plus },
]

const fallbackIcons: IconComponent[] = [
  Hexagon,
  Bookmark,
  Flag,
  Target,
  Compass,
  Hash,
  LayoutGrid,
  Rocket,
  Star,
  Sparkles,
  Zap,
  Cloud,
  Diamond,
  Leaf,
  Box,
]

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getNodeIcon(node: { Module?: string; Route?: string }): IconComponent {
  const text = `${node.Module ?? ''} ${node.Route ?? ''}`.toLowerCase()
  for (const rule of iconRules) {
    if (rule.match.test(text)) return rule.icon
  }
  return fallbackIcons[hashString(text) % fallbackIcons.length]
}
