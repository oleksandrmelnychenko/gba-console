import capability from './currentVparivanieAnalysis.group-capability-fixture.json'
import { analysisDataset } from './currentVparivanieAnalysis.test-fixtures'
import { currentVparivanieAnalysisCapability } from './currentVparivanieAnalysis'
export const mixedDataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: capability } }
export const groupDescriptor = currentVparivanieAnalysisCapability(mixedDataset)!.filters.find(f => f.type === 4)!
