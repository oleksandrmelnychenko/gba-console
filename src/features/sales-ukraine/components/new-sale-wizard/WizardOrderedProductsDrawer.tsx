import { Alert, Group, Loader, Table, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { getClientOrderedProducts } from '../../../clients/api/clientCabinetApi'
import type { ClientOrderedProduct } from '../../../clients/types'

export function WizardOrderedProductsDrawer({
  clientNetId,
  opened,
  onClose,
}: {
  clientNetId: string | null
  opened: boolean
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppDrawer opened={opened} position="right" size="compact" title={t('Замовлені товари')} onClose={onClose}>
      {opened && clientNetId && <WizardOrderedProductsContent clientNetId={clientNetId} />}
    </AppDrawer>
  )
}

function WizardOrderedProductsContent({ clientNetId }: { clientNetId: string }) {
  const { t } = useI18n()
  const [products, setProducts] = useState<ClientOrderedProduct[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(netId: string) {
      setLoading(true)
      setError(null)

      try {
        const next = await getClientOrderedProducts(netId)

        if (!cancelled) {
          setProducts(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProducts([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, t])

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
        {error}
      </Alert>
    )
  }

  if (!products.length) {
    return (
      <Text c="dimmed" size="sm">
        {t('Товарів не знайдено')}
      </Text>
    )
  }

  return (
    <Table highlightOnHover stickyHeader verticalSpacing={6} withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={140}>{t('Код товару')}</Table.Th>
          <Table.Th>{t('Назва товару')}</Table.Th>
          <Table.Th ta="right" w={90}>
            {t('К-сть')}
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {products.map((product, index) => (
          <Table.Tr key={`${product.ProductVendorCode || ''}-${index}`}>
            <Table.Td>{product.ProductVendorCode}</Table.Td>
            <Table.Td>{product.ProductName}</Table.Td>
            <Table.Td ta="right">{product.Qty ?? 0}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
