import { Alert, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { isNotFoundError } from '../../../shared/api/staleRecord'
import { isGuid } from '../../../shared/guid/sameGuid'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getIncompleteSaleByNetUid } from '../api/onlineShopClientsApi'
import { IncompleteSaleItemsList } from '../components/IncompleteSaleItemsList'
import type { IncompleteSale } from '../onlineShopTypes'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

function isSaleLink(netUid: string | undefined): netUid is string {
  return isGuid(netUid) && netUid !== EMPTY_GUID
}

function isMissingSaleError(error: unknown): boolean {
  // The server answers an unknown or empty id with 404 or a 400 «Sale identity is required.».
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
  return isNotFoundError(error) || status === 400
}

export function RetailIncompleteSalePage() {
  const { t } = useI18n()
  const { netUid } = useParams<{ netUid: string }>()
  const hasSaleLink = isSaleLink(netUid)
  const [incompleteSale, setIncompleteSale] = useState<IncompleteSale | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMissing, setMissing] = useState(false)
  const [isLoading, setLoading] = useState(hasSaleLink)

  useEffect(() => {
    if (!isSaleLink(netUid)) {
      return undefined
    }

    let cancelled = false
    const saleNetUid = netUid

    async function loadIncompleteSale() {
      setLoading(true)
      setError(null)
      setMissing(false)

      try {
        const nextIncompleteSale = await getIncompleteSaleByNetUid(saleNetUid)

        if (!cancelled) {
          setIncompleteSale(nextIncompleteSale)
          setMissing(!nextIncompleteSale)
        }
      } catch (loadError) {
        if (!cancelled) {
          setIncompleteSale(null)
          if (isMissingSaleError(loadError)) {
            setMissing(true)
          } else {
            setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
          }
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

  if (netUid && (!hasSaleLink || isMissing)) {
    return (
      <Alert color="yellow" icon={<CircleAlert size={18} />} title={t('Продаж не знайдено')} variant="light">
        {t('Перевірте посилання або відкрийте продаж зі списку незавершених продажів.')}
      </Alert>
    )
  }

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
