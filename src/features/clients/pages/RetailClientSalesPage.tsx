import { Stack } from '@mantine/core'
import { useParams } from 'react-router-dom'
import { OnlineShopSalesPanel } from '../components/OnlineShopSalesPanel'

export function RetailClientSalesPage() {
  const { netUid } = useParams<{ netUid: string }>()

  return (
    <Stack gap="lg">
      <OnlineShopSalesPanel netUid={netUid || ''} />
    </Stack>
  )
}
