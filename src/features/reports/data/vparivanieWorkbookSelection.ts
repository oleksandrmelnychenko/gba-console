import type { ReportDataset, ReportRequestBody } from '../types'
import { analysisGroupIdentity, currentVparivanieAnalysisCapability } from './currentVparivanieAnalysis'

const fields = [
  { type: 21, name: 'Склад' },
  { type: 1, name: 'Номенклатура' },
  { type: 5, name: 'Контрагент' },
  { type: 60, name: 'Основний менеджер покупця' },
]

export function vparivanieSelectionDataset(dataset: ReportDataset | undefined): ReportDataset | undefined {
  const analysis = currentVparivanieAnalysisCapability(dataset)
  if (!dataset || !analysis) return dataset
  return { ...dataset, currentVparivanie: { ...dataset.currentVparivanie as object, analysis: { ...analysis,
    filters: fields.flatMap(field => {
      const descriptor = analysis.filters.find(item => item.type === field.type)
      return descriptor ? [{ ...descriptor, name: field.name, path: [] }] : []
    }),
  } } }
}

export function vparivanieSelectionRequest(request: ReportRequestBody, dataset: ReportDataset): ReportRequestBody {
  const product = currentVparivanieAnalysisCapability(dataset)?.filters.find(field => field.type === 1)
  if (!product?.hierarchy) return request
  return { ...request, selections: request.selections.map(selection => {
    if (selection.SelectedField.Type !== 4 || ![6, 7].includes(selection.FilterCondition.Type)
      || !selection.Values.every(value => analysisGroupIdentity(value.Data)?.kind === 'productGroup')) return selection
    return { ...selection, SelectedField: { Type: 1, Name: 'Номенклатура' },
      Values: selection.Values.map(value => ({ ...value,
        Data: { kind: 'productGroup', id: String(analysisGroupIdentity(value.Data)!.id) },
      })),
    }
  }) }
}
