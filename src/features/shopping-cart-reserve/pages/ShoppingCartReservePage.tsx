import { useEffect, useReducer } from 'react'
import { ActionIcon, Alert, Stack, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getShoppingCartReserves } from '../api/shoppingCartReserveApi'
import { CartReserveTable } from '../components/CartReserveCard'
import type { ShoppingCartReserveItem } from '../types'
import { getCartClientNetUid } from '../utils'
import './shopping-cart-reserve-page.css'

export function ShoppingCartReservePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [carts, setCarts] = useValueState<ShoppingCartReserveItem[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
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

  return (
    <Stack className="shopping-cart-reserve-page" gap={0}>
      <div className="sales-dashboard-tab-content shopping-cart-reserve-card">
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

          {!error && (
            <CartReserveTable
              carts={carts}
              isLoading={isLoading}
              onOpenClient={handleOpenClient}
            />
          )}
        </div>
      </div>
    </Stack>
  )
}
