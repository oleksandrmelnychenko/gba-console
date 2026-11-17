// The server reports a failed data-sync step as a dotted key such as
// "DailySession.MasterData.ExchangeRates" (session mode, stage kind, step).
// These helpers turn such keys into Ukrainian labels for toasts and panels.

const SEGMENT_LABELS: Record<string, string> = {
  // Session
  CompositeSession: 'Сесія синхронізації',
  DailySession: 'Щоденна синхронізація',
  FullSession: 'Повна синхронізація',
  UnknownSession: 'Сесія синхронізації',
  // Stage kinds
  CurrentState: 'Поточний стан: залишки й баланси',
  Documents: 'Документи',
  MasterData: 'Довідники та основні дані',
  PhysicalHistoryRefresh: 'Оновлення історії фізичних рухів',
  SettlementState: 'Взаєморозрахунки',
  WarehousePhysicalDocuments: 'Складські фізичні документи',
  // Data sections
  Accounting: 'Бухгалтерія',
  Clients: 'Клієнти',
  Consignments: 'Партії товарів',
  ExchangeRates: 'Курси валют',
  PaymentRegisters: 'Каси та рахунки',
  Prices: 'Ціни',
  Products: 'Товари',
  // Steps
  AbandonedAfterSystemOfRecordCutover: 'Перервано після переходу на нову систему обліку',
  CounterpartyGroups: 'Групи контрагентів',
  Failed: 'Збій',
  FenixCustomerGraph: 'Структура клієнтів Fenix',
  Initialization: 'Підготовка',
  LoadSyncClients: 'Завантаження клієнтів',
  Recovery: 'Відновлення після збою',
  Run: 'Виконання',
  SourceSync: 'Завантаження з 1С',
  StageLedger: 'Журнал етапів',
  StageRetry: 'Повтор етапу',
  StartFailed: 'Помилка запуску',
}

const STEP_KEY_PATTERN = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*$/
const EMBEDDED_STEP_KEY_PATTERN = /\b[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)+\b/g

/** "DailySession.MasterData.ExchangeRates" → "Щоденна синхронізація → Довідники та основні дані → Курси валют". */
export function formatSyncStepLabel(step?: string | null): string {
  const value = step?.trim() || ''

  if (!value || !STEP_KEY_PATTERN.test(value)) {
    return value
  }

  return value
    .split('.')
    .map((segment) => SEGMENT_LABELS[segment] ?? segment)
    .join(' → ')
}

/** Replaces dotted step keys inside a server message with their Ukrainian labels. */
export function humanizeSyncStepKeys(message?: string | null): string {
  return (message ?? '').replace(EMBEDDED_STEP_KEY_PATTERN, (key) => formatSyncStepLabel(key))
}
