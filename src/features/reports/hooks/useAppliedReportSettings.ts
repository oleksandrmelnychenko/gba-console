import { useState } from 'react'
import type { ReportRequestBody, ReportTemplate } from '../types'
import type { ReportWorkspaceSnapshot } from '../data/reportWorkspaceDraft'

function comparable(snapshot: ReportWorkspaceSnapshot) {
  return JSON.stringify({ name: snapshot.name, data: snapshot.data, measurements: snapshot.measurements })
}

/** The editable form and the immutable request belonging to a displayed result have separate lifetimes. */
export function useAppliedReportSettings(scope: string, draft: ReportWorkspaceSnapshot, request: ReportRequestBody) {
  const makeState = () => ({ scope, baseline: structuredClone(draft), appliedRequest: null as ReportRequestBody | null })
  const [stored, setStored] = useState(makeState)
  let current = stored
  if (current.scope !== scope) {
    current = makeState()
    setStored(current)
  }
  return {
    pending: comparable(current.baseline) !== comparable(draft),
    appliedRequest: current.appliedRequest,
    cancelSnapshot: (activeTemplate: ReportTemplate | null) => {
      // Template revisions/deletions are authoritative server state, not reversible form edits.
      const baseline = structuredClone({ ...current.baseline, activeTemplate, name: activeTemplate?.Name ?? current.baseline.name })
      setStored({ ...current, baseline })
      return baseline
    },
    apply: () => {
      const appliedRequest = structuredClone(request)
      setStored({ scope, baseline: structuredClone(draft), appliedRequest })
      return appliedRequest
    },
  }
}
