import { useMemo } from 'react'
import { fenixDiscountIndex, fenixDiscountValues, type FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
import { DiscountAnalysisMatrixGrid } from './DiscountAnalysisMatrixGrid'
export function OriginalFenixDiscountAnalysisGrid({ result }: { result: FenixDiscountResult }) {
  const index = useMemo(() => fenixDiscountIndex(result), [result])
  return <DiscountAnalysisMatrixGrid index={index} values={fenixDiscountValues} empty={!result.Cells.length} />
}
