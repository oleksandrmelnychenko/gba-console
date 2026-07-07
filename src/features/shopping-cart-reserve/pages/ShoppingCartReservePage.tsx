import { useEffect, useReducer } from 'react'
import { ActionIcon, Alert, Card, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getShoppingCartReserves } from '../api/shoppingCartReserveApi'
import { CartReserveCard } from '../components/CartReserveCard'
import type { ShoppingCartReserveItem } from '../types'
import { getCartClientNetUid, getCartKey } from '../utils'
import './shopping-cart-reserve-page.css'

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
    <Stack className="shopping-cart-reserve-page" gap={6}>
      <Card className="app-data-card shopping-cart-reserve-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar shopping-cart-reserve-command-bar">
          <div className="app-filter-actions shopping-cart-reserve-command-actions">
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={() => reload()}
              >
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        <div className="shopping-cart-reserve-content">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading && (
            <div className="shopping-cart-reserve-skeleton" aria-label={t('Завантаження кошиків')} aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="shopping-cart-reserve-skeleton-card">
                  <span className="shopping-cart-reserve-skeleton-line is-title" />
                  <span className="shopping-cart-reserve-skeleton-line" />
                  <span className="shopping-cart-reserve-skeleton-line is-short" />
                </div>
              ))}
            </div>
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
        </div>
      </Card>
    </Stack>
  )
}
