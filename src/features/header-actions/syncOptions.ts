import type { TranslationKey } from '../../shared/i18n/types'
import { SyncEntityType, SyncProductConsignmentType } from './types'

export const syncTypeOptions: Array<{ details: string[]; label: TranslationKey; value: string }> = [
  {
    value: String(SyncEntityType.Products),
    label: 'Товари',
    details: [
      'Одиниці виміру',
      'Переклад одиниць виміру',
      'Товари',
      'Товарні групи',
      "Прив'язка товарів до товарних груп",
      'Аналоги',
      'Компоненти',
      'Оригінальні номери',
      'Цінові рівні',
      'Ціни на товари',
    ],
  },
  {
    value: String(SyncEntityType.Clients),
    label: 'Клієнти',
    details: [
      'Регіони',
      'Клієнти і постачальники',
      'Адреси',
      'Податкові',
      'Організації',
      'Склади',
      'Цінові рівні',
      'Договори і знижки по договорам',
      'Отримувачі',
      'Структура клієнта',
    ],
  },
  {
    value: String(SyncEntityType.Consignments),
    label: 'Залишки',
    details: ['Податкові', 'Організації', 'Адреси організацій', 'Склади', 'Залишки по партіям', 'Митні коди'],
  },
  {
    value: String(SyncEntityType.Accounting),
    label: 'Взаєморозрахунки',
    details: ['Історія курсів валют', 'Баланси і борги'],
  },
  {
    value: String(SyncEntityType.PaymentRegisters),
    label: 'Грошові рахунки',
    details: ['Банки', 'Податкові', 'Організації', 'Касові рахунки', 'Банківські рахунки'],
  },
]

export const defaultSelectedSyncTypes = Object.fromEntries(syncTypeOptions.map((option) => [option.value, true])) as Record<
  string,
  boolean
>

export const dailySyncTypeOptions: Array<{ label: TranslationKey; value: string }> = [
  { label: 'Прихідні накладні на товар', value: String(SyncProductConsignmentType.Order) },
  { label: 'Оприходування', value: String(SyncProductConsignmentType.Capitalization) },
  { label: 'Повернення від клієнта', value: String(SyncProductConsignmentType.SaleReturn) },
  { label: 'Переміщення товарів', value: String(SyncProductConsignmentType.ProductTransfers) },
  { label: 'Списання товарів', value: String(SyncProductConsignmentType.DepreciatedOrders) },
  { label: 'Акт списання оприходування', value: String(SyncProductConsignmentType.ActProductTransfers) },
  { label: 'Рахунки та Видаткові накладні', value: String(SyncProductConsignmentType.Sales) },
  { label: 'Прибуткові касові ордери', value: String(SyncProductConsignmentType.IncomeCashOrder) },
  { label: 'Прибуткові банківські ордери', value: String(SyncProductConsignmentType.IncomeBankOrder) },
  { label: 'Видаткові касові ордери', value: String(SyncProductConsignmentType.OutcomeCashOrder) },
  { label: 'Видаткові банківські ордери', value: String(SyncProductConsignmentType.OutcomeBankOrder) },
  { label: 'Внутрішнє переміщення грошових коштів', value: String(SyncProductConsignmentType.InternalMovementOfFunds) },
]

export const allDailySyncTypes = dailySyncTypeOptions.map((option) => option.value)
