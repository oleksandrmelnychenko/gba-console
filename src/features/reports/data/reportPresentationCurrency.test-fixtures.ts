import { documentDataset, documentRequest } from './currentFinancialDocumentAxes.test-fixtures'
export const currencyCapability = { version: 1, defaultCurrency: 'EUR', rateFamily: 'commercialGba', datePolicy: 'ownDocument',
  allowedProfitReadModes: [0], allowedDayOrganizationBases: [0], lookupPath: '/currencies/all' }
export const currencyDataset = { ...documentDataset, currentFinancialPresentationCurrency: currencyCapability }
export const currencySelection = { version: 1 as const, currencyNetUid: '11111111-2222-3333-4444-555555555555' }
export const currencyRequest = () => ({ ...documentRequest([81], [5]), presentationCurrency: { ...currencySelection } })
export const resolvedCurrency = { ...currencySelection, code: 'UAH', rateFamily: 'commercialGba' as const, datePolicy: 'ownDocument' as const }
