import { SegmentedControl, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  fetchDataEnvironment,
  markDocumentEnvironment,
  writeDataEnvironmentCookie,
  type DataEnvironment,
  type DataEnvironmentState,
} from '../../../shared/environment/dataEnvironment'
import { useI18n } from '../../../shared/i18n/useI18n'

export function DataEnvironmentSwitch() {
  const { t } = useI18n()
  const [state, setState] = useState<DataEnvironmentState | null>(null)

  useEffect(() => {
    let alive = true
    void fetchDataEnvironment().then(next => {
      if (!alive || !next) return
      markDocumentEnvironment(next.active)
      setState(next)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!state) return null

  const change = (value: string) => {
    const next: DataEnvironment = value === 'qa' ? 'qa' : 'dev'
    if (next === state.active) return
    writeDataEnvironmentCookie(next)
    window.location.reload()
  }

  return (
    <Tooltip
      label={state.active === 'qa' ? t('QA: тестова копія бази, зміни не потрапляють у DEV') : t('DEV: основна база з даними 1С')}
      withArrow
      openDelay={300}
    >
      <SegmentedControl
        className={`console-env-switch is-${state.active}`}
        size="xs"
        radius="xl"
        aria-label={t('База даних')}
        value={state.active}
        onChange={change}
        data={[
          { value: 'dev', label: 'DEV' },
          { value: 'qa', label: 'QA' },
        ]}
      />
    </Tooltip>
  )
}
