import { Alert, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getIncompleteSaleByNetUid } from '../api/onlineShopClientsApi'
import { IncompleteSaleItemsList } from '../components/IncompleteSaleItemsList'
import type { IncompleteSale } from '../onlineShopTypes'

export function RetailIncompleteSalePage() {
  const { t } = useI18n()
  const { netUid } = useParams<{ netUid: string }>()
  const [incompleteSale, setIncompleteSale] = useState<IncompleteSale | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(Boolean(netUid))

  useEffect(() => {
    if (!netUid) {
      return undefined
    }

    let cancelled = false

    async function loadIncompleteSale() {
      setLoading(true)
      setError(null)

      try {
        const nextIncompleteSale = await getIncompleteSaleByNetUid(netUid || '')

        if (!cancelled) {
          setIncompleteSale(nextIncompleteSale)
        }
      } catch (loadError) {
        if (!cancelled) {
          setIncompleteSale(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadIncompleteSale()

    return () => {
      cancelled = true
    }
  }, [netUid, t])

  return (
    <Stack gap="lg">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          {netUid && error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {netUid && isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="orange" size="sm" />
              <Text size="sm" c="dimmed">
                {t('Завантаження товарів')}
              </Text>
            </Group>
          ) : (
            <IncompleteSaleItemsList
              emptyText={t('Товарів не знайдено')}
              items={(netUid ? incompleteSale?.OrderItems || [] : []).filter((item) => item.Product)}
            />
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
