import { useEffect, useState } from 'react'
import { getClientRegionManualEdit } from '../api/clientsApi'
import type { ClientRegionManualEdit } from '../types'

type LoadedRegionManualEdit = {
  key: string
  edit: ClientRegionManualEdit | null
}

export function useClientRegionManualEdit(
  clientNetUid: string | undefined,
  version: string,
  enabled: boolean,
): ClientRegionManualEdit | null {
  const key = enabled && clientNetUid ? `${clientNetUid}:${version}` : null
  const [loaded, setLoaded] = useState<LoadedRegionManualEdit | null>(null)

  useEffect(() => {
    if (!key || !clientNetUid) {
      return
    }

    const controller = new AbortController()
    getClientRegionManualEdit(clientNetUid, controller.signal)
      .then((edit) => {
        if (!controller.signal.aborted) {
          setLoaded({ key, edit })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoaded({ key, edit: null })
        }
      })

    return () => controller.abort()
  }, [clientNetUid, key])

  return loaded && loaded.key === key ? loaded.edit : null
}
