import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { getCockpitTarget } from '../api/salesCockpitApi'
import { useWorkdayResource } from '../hooks/useWorkdayResource'
import { CockpitTargetCard } from './CockpitTargetCard'

export function WorkdayPlanPanel({ revision, paused }: { revision: number; paused: boolean }) {
  const { t } = useI18n()
  const [date, setDate] = useState('')
  const [retry, refresh] = useReducer((x: number) => x + 1, 0)
  const load = useCallback(() => getCockpitTarget(date || undefined), [date])
  const state = useWorkdayResource(load, `${date}:${revision}:${retry}`, paused)
  const hasData = state.data && [state.data.shipped, state.data.paid].some((metric) => metric.target > 0 || metric.mtd > 0 || metric.today_needed > 0)
  return <Stack gap="xs">
    <Group align="end"><AppDateInput type="date" label={t('Дата розрахунку плану')} value={date} onChange={(event) => setDate(event.currentTarget.value)} />
      <Button variant="subtle" onClick={() => setDate('')} disabled={!date}>{t('Поточна дата')}</Button>
      <Text c="dimmed" size="xs">{t('Черга задач — поточна')}</Text>
    </Group>
    {state.loading ? <Loader aria-label={t('Завантаження плану')} size="sm" /> : state.error ? <Alert color="red" title={t('План тимчасово недоступний')}>{state.error}<Button size="xs" variant="subtle" onClick={refresh}>{t('Повторити завантаження плану')}</Button></Alert> : hasData && state.data ? <CockpitTargetCard target={state.data} /> : null}
  </Stack>
}
