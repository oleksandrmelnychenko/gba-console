import { Alert, Badge, Group, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getCockpitSource, type CockpitSource } from '../api/sourceApi'

const timeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv',
})
const formatTime = (value: string) => timeFormatter.format(new Date(value))

export function CockpitSourceStatus({ head = false }: { head?: boolean }) {
  const { t } = useI18n()
  const [state, setState] = useState<{ data?: CockpitSource; error?: boolean }>({})
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const load = async () => {
      if (pending) return
      pending = true
      try {
        const data = await getCockpitSource(head, controller.signal)
        if (!controller.signal.aborted) setState({ data })
      } catch {
        if (!controller.signal.aborted) setState({ error: true })
      } finally { pending = false }
    }
    void load()
    const interval = window.setInterval(() => void load(), 60_000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [head])

  if (state.error) return <Alert color="yellow" variant="light">{t('Джерело даних не підтверджено')}</Alert>
  const data = state.data
  if (!data) return <Text size="xs" c="dimmed">{t('Перевіряємо джерело даних…')}</Text>
  const expected = document.documentElement.dataset.gbaEnv
  const mismatch = expected && data.sourceEnvironment !== expected
  const warning = mismatch || !data.sourceAvailable || !data.taskStoreAvailable || !data.sourceReady || !data.generationReady
  const environment = data.sourceEnvironment === 'shared' ? t('Спільне джерело DEV/QA') : data.sourceEnvironment.toUpperCase()
  return <Alert color={warning ? 'yellow' : 'gray'} variant="light" py={6}>
    <Group gap={8}>
      <Badge variant="light">{t('Клієнти й робоча черга')}: {environment}</Badge>
      <Text size="xs">{t('Перевірено')}: {formatTime(data.asOf)} ({t('Київ')})</Text>
      <Text size="xs">{t('Остання активність продажів')}: {data.watermark ? formatTime(data.watermark) : t('Немає даних')}</Text>
    </Group>
    <Text size="xs" c="dimmed">{t('Дата активності продажів не підтверджує завершення синхронізації.')}</Text>
    <Text size="xs" c="dimmed">{t('Ця перевірка не охоплює товарні рекомендації; їхнє джерело окремо не підтверджено.')}</Text>
    {mismatch && <Text size="xs">{t('Джерело відрізняється від вибраного середовища.')}</Text>}
    {(!data.sourceAvailable || !data.taskStoreAvailable) && <Text size="xs">{t('Не вдалося перевірити доступність усіх джерел.')}</Text>}
    {!data.generationEnabled && <Text size="xs">{t('Автоматичне формування AI-задач у цьому середовищі вимкнено.')}</Text>}
    {!data.sourceReady && <Text size="xs">{t('Дані джерела ще не готові для AI-черги.')}</Text>}
    {!data.generationReady && <Text size="xs">{t('Актуальне формування AI-черги не підтверджено.')}</Text>}
  </Alert>
}
