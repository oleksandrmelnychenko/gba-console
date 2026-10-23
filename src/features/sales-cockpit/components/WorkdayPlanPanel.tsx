import { Alert, Button, Loader, Stack } from '@mantine/core'
import { useCallback, useReducer, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { getCockpitTarget } from '../api/salesCockpitApi'
import { useWorkdayResource } from '../hooks/useWorkdayResource'
import { CockpitTargetCard } from './CockpitTargetCard'

export function WorkdayPlanPanel({ revision, paused, toolbarActions }: { revision: number; paused: boolean; toolbarActions?: ReactNode }) {
  const { t } = useI18n()
  const [date, setDate] = useState('')
  const [retry, refresh] = useReducer((x: number) => x + 1, 0)
  const load = useCallback(() => getCockpitTarget(date || undefined), [date])
  const state = useWorkdayResource(load, `${date}:${revision}:${retry}`, paused)
  const hasData = state.data && [state.data.shipped, state.data.paid].some((metric) => metric.target > 0 || metric.mtd > 0 || metric.today_needed > 0)
  return <Stack gap="xs">
    <div className="app-filter-bar cockpit-workday-plan-toolbar"><div className="app-filter-field" title={t('Черга задач — поточна')}><AppDateInput type="date" label={t('Дата розрахунку плану')} value={date} onChange={(event) => setDate(event.currentTarget.value)} /></div>
      <Button variant="default" leftSection={<RotateCcw size={16} />} onClick={() => setDate('')} disabled={!date}>{t('Поточна дата')}</Button>
      <div className="app-filter-actions cockpit-workday-plan-actions">{toolbarActions}</div>
    </div>
    {state.loading ? <Loader aria-label={t('Завантаження плану')} size="sm" /> : state.error ? <Alert color="red" title={t('План тимчасово недоступний')}>{state.error}<Button size="xs" variant="subtle" onClick={refresh}>{t('Повторити завантаження плану')}</Button></Alert> : hasData && state.data ? <CockpitTargetCard target={state.data} /> : null}
  </Stack>
}
