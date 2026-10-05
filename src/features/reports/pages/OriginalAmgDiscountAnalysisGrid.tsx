import { useMemo } from 'react'
import { amgDiscountAnalysisIndex, amgDiscountAnalysisValues, type AmgDiscountAnalysisResult } from '../data/originalAmgDiscountAnalysis'
import { DiscountAnalysisMatrixGrid } from './DiscountAnalysisMatrixGrid'
export function OriginalAmgDiscountAnalysisGrid({ result }: { result: AmgDiscountAnalysisResult }) {
  const index = useMemo(() => amgDiscountAnalysisIndex(result), [result])
  return <DiscountAnalysisMatrixGrid index={index} values={amgDiscountAnalysisValues} empty={!result.Cells.length} />
}
