import { useEffect, useReducer } from 'react'
import { ActionIcon, Alert, Badge, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getShoppingCartReserves } from '../api/shoppingCartReserveApi'
import { CartReserveCard } from '../components/CartReserveCard'
import type { ShoppingCartReserveItem } from '../types'
import { getCartClientNetUid, getCartKey } from '../utils'

export function ShoppingCartReservePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [carts, setCarts] = useValueState<ShoppingCartReserveItem[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [expandedKey, setExpandedKey] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let cancelled = false

    async function loadCarts() {
      setLoading(true)
      setError(null)

      try {
        const nextCarts = await getShoppingCartReserves()

        if (!cancelled) {
          setCarts(nextCarts)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCarts([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити кошики'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCarts()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setCarts, setError, setLoading, t])

  function handleOpenClient(cart: ShoppingCartReserveItem) {
    const netUid = getCartClientNetUid(cart)

    if (netUid) {
      navigate(`/clients/edit/${netUid}`)
      return
    }

    navigate('/clients')
  }

  function handleToggle(index: number) {
    const key = getCartKey(carts[index], index)

    setExpandedKey((current) => (current === key ? null : key))
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="center">
        <Group gap="xs">
          <Badge color="gray" variant="light">
            {isLoading ? t('Завантаження') : `${t('Записів')}: ${carts.length}`}
          </Badge>
          <Tooltip label={t('Оновити')}>
            <ActionIcon variant="light" color="gray" aria-label={t('Оновити')} onClick={() => reload()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading && (
        <Group justify="center" py="md">
          <Loader color="violet" size="sm" />
          <Text size="sm" c="dimmed">
            {t('Завантаження кошиків')}
          </Text>
        </Group>
      )}

      {!isLoading && !error && carts.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t('Кошиків не знайдено')}
        </Text>
      )}

      {carts.map((cart, index) => {
        const key = getCartKey(cart, index)

        return (
          <CartReserveCard
            key={key}
            cart={cart}
            index={index}
            isExpanded={expandedKey === key}
            onOpenClient={handleOpenClient}
            onToggle={handleToggle}
          />
        )
      })}
    </Stack>
  )
}
