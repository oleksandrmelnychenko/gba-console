import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { createRoot } from 'react-dom/client'
import { ProductOutcomeHorizontalScroll } from '../../src/features/products/components/ProductOutcomeHorizontalScroll'
import '../../src/features/products/pages/products.css'
import { DataTable } from '../../src/shared/ui/data-table/DataTable'
import { I18nProvider } from '../../src/shared/i18n/I18nProvider'

const columns = [
  { id: 'date', header: 'Дата', width: 150, accessor: (row: Record<string, string>) => row.date },
  { id: 'type', header: 'Тип документа', width: 150, accessor: (row: Record<string, string>) => row.type },
  { id: 'storage', header: 'Склад', width: 140, accessor: (row: Record<string, string>) => row.storage },
  { id: 'organization', header: 'Організація', width: 160, accessor: (row: Record<string, string>) => row.organization },
  { id: 'number', header: 'Номер', width: 140, accessor: (row: Record<string, string>) => row.number },
  { id: 'client', header: 'Клієнт', minWidth: 190, fill: true, accessor: (row: Record<string, string>) => row.client },
  { id: 'manager', header: 'Відповідальний', width: 190, accessor: (row: Record<string, string>) => row.manager },
  { id: 'price', header: 'Ціна', width: 110, accessor: (row: Record<string, string>) => row.price },
  { id: 'quantity', header: 'Кількість', width: 110, accessor: (row: Record<string, string>) => row.quantity },
]

const data = [{
  date: '21.09.2026', type: 'Видаткова накладна', storage: 'Склад', organization: 'Організація',
  number: 'CH0000001', client: 'Клієнт', manager: 'Менеджер', price: '90,20', quantity: '1',
}]

createRoot(document.getElementById('root')!).render(
  <MantineProvider>
    <I18nProvider>
      <div className="product-inline-movement-body is-outcome" style={{ width: '100%', maxWidth: 2000 }}>
        <ProductOutcomeHorizontalScroll label="Горизонтальна прокрутка таблиці">
          <DataTable
            columns={columns}
            data={data}
            density="normal"
            fillAvailableWidth
            getRowId={(row) => row.number}
            maxHeight={360}
            minWidth={1900}
            showDensityToggle={false}
            showLayoutControls={false}
            tableId="bug1276-outcome-browser-fixture"
          />
        </ProductOutcomeHorizontalScroll>
      </div>
    </I18nProvider>
  </MantineProvider>,
)
