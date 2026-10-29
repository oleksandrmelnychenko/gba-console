import type { WorkbookAttribute } from '../data/workbookPreview'
import { workbookHasText } from '../data/workbookPresentation'

export function CurrentProductGroupsValue({ value }: { value: WorkbookAttribute | undefined }) {
  if (!value || value.state !== 'known' || !value.references) return <>—</>
  if (value.references.length === 0) return <>Немає груп</>
  return <ul className="report-current-product-groups" aria-label="Групи поточного товару">
    {value.references.map(group => <li key={group.id}>{workbookHasText(group.caption) ? group.caption : 'Без назви'}</li>)}
  </ul>
}
