import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readFenixDiscountChoicePage } from '../api/originalFenixClientDiscountPagesApi'
import { fenixChoicePageRequest, type FenixDiscountCatalogue, type FenixDiscountChoicePage } from '../data/originalFenixClientDiscountPages'
import type { FenixDiscountField } from '../data/originalFenixClientDiscounts'
export function useFenixDiscountChoicePage(through: string, catalogue: FenixDiscountCatalogue | null, field: FenixDiscountField, callerScope: object, selected: readonly string[]) {
  const scope = useMemo(() => ({ catalogue, field, callerScope, through }), [catalogue, field, callerScope, through])
  const current = useRef(scope), selectedNow = useRef(selected), active = useRef<AbortController | null>(null)
  current.current = scope; selectedNow.current = selected
  const [state, setState] = useState<{ scope: typeof scope; page: FenixDiscountChoicePage | null; busy: boolean; error: string | null }>({ scope, page: null, busy: false, error: null })
  const load = useCallback(async (search: string, offset: number) => {
    if (current.current !== scope || !catalogue?.OurSnapshotVerified || !catalogue.FieldAvailability[field]) return
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    const valid = () => !controller.signal.aborted && current.current === scope && active.current === controller
    setState({ scope, page: null, busy: true, error: null })
    try {
      const query = fenixChoicePageRequest(through, catalogue, field, search, offset, selectedNow.current)
      const page = await readFenixDiscountChoicePage(query, catalogue, controller.signal)
      if (valid()) setState({ scope, page, busy: false, error: null })
    } catch (failure) { if (valid()) setState({ scope, page: null, busy: false, error: failure instanceof Error ? failure.message : 'Не вдалося завантажити сторінку назв.' }) }
    finally { if (valid()) setState(old => old.scope === scope ? { ...old, busy: false } : old) }
  }, [catalogue, field, scope, through])
  const cancel = useCallback(() => { active.current?.abort(); setState({ scope, page: null, busy: false, error: null }) }, [scope])
  useEffect(() => { void load('', 0); return () => active.current?.abort() }, [load])
  return { page: state.scope === scope ? state.page : null, busy: state.scope === scope && state.busy, error: state.scope === scope ? state.error : null, load, cancel }
}
