import { Alert, Badge, Group, Loader, Select, Stack, Table, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getHeadDismissals } from '../api/salesCockpitApi'
import type { HeadDismissalsResponse } from '../types'

const WINDOW_OPTIONS = [
  { label: '7 днів', value: '7' },
  { label: '30 днів', value: '30' },
  { label: '90 днів', value: '90' },
]

const TOP_REASONS_SHOWN = 6

// Rendered on the «Неактуальні» tab of the head board: what the team rejects and WHY —
// the aggregation the dismiss reasons are collected for.
export function HeadDismissalsPanel({ managerId }: { managerId: number | null }) {
  const { t } = useI18n()
  const [data, setData] = useValueState<HeadDismissalsResponse | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useValueState('30')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setLoading(true)

      try {
        const result = await getHeadDismissals({
          windowDays: Number(windowDays),
          managerId: managerId ?? undefined,
        })

        if (!cancelled) {
          setData(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити аналітику відмов'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [managerId, setData, setError, t, windowDays])

  if (data && !data.is_head) {
    return null
  }

  return (
    <div className="cockpit-dismissals-panel">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text fw={600} size="sm">
              {t('Причини «не актуально»')}
            </Text>
            {!isLoading && data && (
              <Text c="dimmed" size="sm">
                {t('відхилено')} {data.total_dismissed} {t('за')} {data.window_days} {t('дн.')}
              </Text>
            )}
          </Group>
          <Select
            aria-label={t('Період')}
            data={WINDOW_OPTIONS}
            size="xs"
            value={windowDays}
            w={110}
            onChange={(value) => value && setWindowDays(value)}
          />
        </Group>

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Group justify="center" py="sm">
            <Loader size="sm" />
          </Group>
        ) : !data || data.total_dismissed === 0 ? (
          <Text c="dimmed" size="sm">
            {t('За обраний період відхилених задач немає')}
          </Text>
        ) : (
          <>
            {data.top_reasons.length > 0 && (
              <Group gap={6} wrap="wrap">
                {data.top_reasons.slice(0, TOP_REASONS_SHOWN).map((reason) => (
                  <Badge color="red" key={reason.reason} radius="sm" variant="light">
                    {reason.reason} · {reason.count}
                  </Badge>
                ))}
              </Group>
            )}

            {managerId === null && data.managers.length > 0 && (
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing={6} withRowBorders={false}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Менеджер')}</Table.Th>
                      <Table.Th ta="right">{t('Відхилено')}</Table.Th>
                      <Table.Th ta="right">{t('Без причини')}</Table.Th>
                      <Table.Th>{t('Головна причина')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.managers.map((manager) => (
                      <Table.Tr key={manager.manager_id}>
                        <Table.Td>{manager.manager_name ?? `#${manager.manager_id}`}</Table.Td>
                        <Table.Td ta="right">{manager.dismissed}</Table.Td>
                        <Table.Td ta="right">{manager.no_reason}</Table.Td>
                        <Table.Td>
                          {manager.reasons[0]
                            ? `${manager.reasons[0].reason} (${manager.reasons[0].count})`
                            : '—'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </>
        )}
      </Stack>
    </div>
  )
}
