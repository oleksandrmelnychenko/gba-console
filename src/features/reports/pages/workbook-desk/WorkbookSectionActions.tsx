import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SectionActionsTarget = createContext<HTMLElement | null | undefined>(undefined)

/** Keep locally owned actions in their section toolbar; legacy layouts render inline. */
export function WorkbookSectionActions({ children }: { children: ReactNode }) {
  const target = useContext(SectionActionsTarget)
  if (target === undefined) return <>{children}</>
  return target ? createPortal(children, target) : null
}

export function WorkbookSectionToolbar({ heading, disabled, children }: {
  heading: ReactNode
  disabled: boolean
  children: ReactNode
}) {
  const [target, setTarget] = useState<HTMLFieldSetElement | null>(null)
  return <SectionActionsTarget.Provider value={target}>
    <div className="workbook-settings__section-head">
      {heading}
      <fieldset ref={setTarget} disabled={disabled} className="workbook-settings__section-actions" />
    </div>
    {children}
  </SectionActionsTarget.Provider>
}
