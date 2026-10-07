import { ReportsStocksPage } from './ReportsStocksPage'

export function ReportsConstructorPage({ consoleScope = true }: { consoleScope?: boolean }) {
  return <ReportsStocksPage consoleScope={consoleScope} constructorMode />
}
