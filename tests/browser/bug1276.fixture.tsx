import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { createRoot } from 'react-dom/client'
import '../../src/features/products/pages/products.css'
import { DataTable } from '../../src/shared/ui/data-table/DataTable'
import { I18nProvider } from '../../src/shared/i18n/I18nProvider'

type OutcomeRow = Record<'client' | 'date' | 'manager' | 'number' | 'organization' | 'price' | 'quantity' | 'storage' | 'type', string>

const columns = [
  { id: 'date', header: 'Дата', width: 150, accessor: (row: OutcomeRow) => row.date },
  { id: 'type', header: 'Тип документа', width: 150, accessor: (row: OutcomeRow) => row.type },
  { id: 'storage', header: 'Склад', width: 140, accessor: (row: OutcomeRow) => row.storage },
  { id: 'organization', header: 'Організація', width: 160, accessor: (row: OutcomeRow) => row.organization },
  { id: 'number', header: 'Номер', width: 140, accessor: (row: OutcomeRow) => row.number },
  { id: 'client', header: 'Клієнт', minWidth: 190, fill: true, accessor: (row: OutcomeRow) => row.client },
  { id: 'manager', header: 'Відповідальний', width: 190, accessor: (row: OutcomeRow) => row.manager },
  { id: 'price', header: 'Ціна', width: 110, accessor: (row: OutcomeRow) => row.price },
  { id: 'quantity', header: 'Кількість', width: 110, accessor: (row: OutcomeRow) => row.quantity },
]

const data = Array.from({ length: 30 }, (_, index): OutcomeRow => ({
  client: `Клієнт ${index + 1}`,
  date: '21.09.2026',
  manager: 'Менеджер',
  number: `CH${String(index + 1).padStart(7, '0')}`,
  organization: 'Організація',
  price: '90,20',
  quantity: '1',
  storage: 'Склад',
  type: 'Видаткова накладна',
}))

createRoot(document.getElementById('root')!).render(
  <MantineProvider>
    <I18nProvider>
      <div className="bug1276-workspace" style={{ inset: 0, overflowY: 'auto', position: 'fixed' }}>
        <div style={{ height: 'calc(100vh - 120px)' }} />
        <div className="product-inline-table-frame" style={{ margin: '0 24px' }}>
          <div className="product-inline-movement-body is-outcome">
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
              stickyHorizontalScrollbar
              tableId="bug1276-outcome-browser-fixture"
            />
          </div>
        </div>
        <div style={{ height: 240 }} />
      </div>
    </I18nProvider>
  </MantineProvider>,
)
