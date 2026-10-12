import { Alert, Select } from '@mantine/core'
import { useEffect, useState } from 'react'
import { apiRequest } from '../../../../shared/api/apiClient'
import { useI18n } from '../../../../shared/i18n/useI18n'

type Warehouse = { Id: number; Name?: string; OrganizationId?: number | null; Deleted?: boolean }

export function SaleDocumentWarehouseSelect({ value, flow, disabled, onChange }: {
  value: number | null
  flow: 'create' | 'edit'
  disabled: boolean
  onChange: (value: number) => void
}) {
  const { t } = useI18n()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [failure, setFailure] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void apiRequest<Warehouse[]>(`/storages/sales-ukraine/${flow}/document-warehouses`, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setWarehouses(Array.isArray(rows) ? rows : [])
          setFailure(!Array.isArray(rows))
        }
      })
      .catch(() => { if (!controller.signal.aborted) setFailure(true) })
    return () => controller.abort()
  }, [flow])
  const options = warehouses.filter((warehouse) => Number.isSafeInteger(warehouse.Id) && warehouse.Id > 0 &&
    (!warehouse.Deleted ||
      warehouse.Id === value))
    .map((warehouse) => ({ value: String(warehouse.Id), label: warehouse.Name?.trim() || `${t('Склад')} №${warehouse.Id}` }))
  if (value && !options.some((option) => option.value === String(value))) {
    options.push({ value: String(value), label: `${t('Склад')} №${value}` })
  }
  return <>
    <Select label={t('Склад документа')} data={options} value={value ? String(value) : null}
      placeholder={disabled ? t('Не вказано в документі') : t('Оберіть склад')}
      disabled={disabled} required={!disabled} searchable
      onChange={(selected) => { if (selected) onChange(Number(selected)) }} />
    {failure && <Alert color="orange">{t('Не вдалося завантажити склади')}</Alert>}
  </>
}
