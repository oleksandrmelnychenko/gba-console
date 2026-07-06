import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Popover,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import type {
  Client,
  ClientContractDocument,
  Country,
  Incoterm,
  PackingMarking,
  PackingMarkingPayment,
  Region,
  RegionCode,
} from '../../types'

export type ClientFormRole = {
  isProvider: boolean
  isBuyer: boolean
  isSubClient: boolean
}

export type ClientFieldErrors = Partial<Record<string, string>>

export type GeneralInfoFieldsProps = {
  client: Client
  role: ClientFormRole
  countries: Country[]
  incoterms: Incoterm[]
  packingMarkings: PackingMarking[]
  packingMarkingPayments: PackingMarkingPayment[]
  regions: Region[]
  errors?: ClientFieldErrors
  isLoadingRegionCode?: boolean
  isUploadingDocuments?: boolean
  canSaveDocuments?: boolean
  isNew?: boolean
  regionCodeError?: string
  onChange: <K extends keyof Client>(key: K, value: Client[K]) => void
  onRegionChange: (region: Region | null) => void
  onRegionCodeFieldChange: (key: 'Value' | 'City' | 'District', value: string) => void
  onAddDocuments: (files: File[]) => void
  onRemoveDocument: (document: ClientContractDocument) => void
  onSaveDocuments: () => void
  onCreateIncoterm: (name: string) => void
  onCreateCountry: (name: string, code: string) => void
  onCreateRegion: (name: string) => void
}

export function GeneralInfoFields(props: GeneralInfoFieldsProps) {
  const { t } = useI18n()
  const { client, errors, role } = props

  return (
    <Stack gap="md">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text className="client-section-title" fw={600}>{t('Основна інформація')}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <TextInput
              error={errors?.FullName}
              label={t('Повна назва')}
              maxLength={100}
              value={client.FullName || ''}
              onChange={(event) => props.onChange('FullName', event.currentTarget.value)}
            />
            {role.isProvider ? (
              <TextInput
                error={errors?.Brand}
                label={t('Бренд')}
                maxLength={100}
                value={client.Brand || ''}
                onChange={(event) => props.onChange('Brand', event.currentTarget.value)}
              />
            ) : (
              <TextInput
                error={errors?.Name}
                label={t('Назва')}
                maxLength={100}
                value={client.Name || ''}
                onChange={(event) => props.onChange('Name', event.currentTarget.value)}
              />
            )}
          </SimpleGrid>
        </Stack>
      </Card>

      {role.isProvider && <ProviderFields {...props} />}
      {role.isBuyer && <BuyerFields {...props} />}
    </Stack>
  )
}

function ProviderFields(props: GeneralInfoFieldsProps) {
  const { t } = useI18n()
  const { client, errors } = props

  return (
    <Stack gap="md">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text className="client-section-title" fw={600}>{t('Дані постачальника')}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <TextInput
              error={errors?.SupplierCode}
              label={t('Код постачальника')}
              maxLength={100}
              value={client.SupplierCode || ''}
              onChange={(event) => props.onChange('SupplierCode', event.currentTarget.value)}
            />
            <TextInput
              error={errors?.SupplierName}
              label={t('Постачальник')}
              maxLength={100}
              value={client.SupplierName || client.Manufacturer || ''}
              onChange={(event) => props.onChange('SupplierName', event.currentTarget.value)}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text className="client-section-title" fw={600}>{t('Умови постачання')}</Text>
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <Select
              clearable
              searchable
              data={props.incoterms.map((incoterm) => ({
                value: String(incoterm.Id),
                label: incoterm.IncotermName || '',
              }))}
              label={t('Incoterms')}
              placeholder={t('Оберіть Incoterms')}
              style={{ flex: '1 1 auto' }}
              value={client.Incoterm?.Id != null ? String(client.Incoterm.Id) : null}
              onChange={(value) => {
                const next = props.incoterms.find((incoterm) => String(incoterm.Id) === value) || undefined
                props.onChange('Incoterm', next)
              }}
            />
            <NewIncotermControl onCreate={props.onCreateIncoterm} />
          </Group>

          <Group gap="xl">
            <Checkbox
              checked={Boolean(client.IsIncotermsElse)}
              label={t('Обрати інший')}
              onChange={(event) => props.onChange('IsIncotermsElse', event.currentTarget.checked)}
            />
            <Checkbox
              checked={Boolean(client.IsNotResident)}
              label={t('Не резидент')}
              onChange={(event) => props.onChange('IsNotResident', event.currentTarget.checked)}
            />
          </Group>

          <TextInput
            disabled={!client.IsIncotermsElse}
            error={errors?.IncotermsElse}
            label={t('Інше')}
            maxLength={100}
            value={client.IncotermsElse || ''}
            onChange={(event) => props.onChange('IncotermsElse', event.currentTarget.value)}
          />

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm" style={{ alignItems: 'end' }}>
            <Select
              clearable
              searchable
              data={props.packingMarkings.map((marking) => ({
                value: String(marking.Id),
                label: marking.Name || '',
              }))}
              label={t('Маркування пакування')}
              placeholder={t('Оберіть значення')}
              value={client.PackingMarking?.Id != null ? String(client.PackingMarking.Id) : null}
              onChange={(value) => {
                const next = props.packingMarkings.find((marking) => String(marking.Id) === value) || undefined
                props.onChange('PackingMarking', next)
              }}
            />
            <Select
              clearable
              searchable
              data={props.packingMarkingPayments.map((payment) => ({
                value: String(payment.Id),
                label: payment.Name || '',
              }))}
              label={t('Оплата маркування пакування')}
              placeholder={t('Оберіть значення')}
              value={client.PackingMarkingPayment?.Id != null ? String(client.PackingMarkingPayment.Id) : null}
              onChange={(value) => {
                const next = props.packingMarkingPayments.find((payment) => String(payment.Id) === value) || undefined
                props.onChange('PackingMarkingPayment', next)
              }}
            />
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <Select
                clearable
                searchable
                data={props.countries.map((country) => ({
                  value: String(country.Id),
                  label: country.Name || '',
                }))}
                label={t('Країна')}
                placeholder={t('Оберіть країну')}
                style={{ flex: '1 1 auto' }}
                value={client.Country?.Id != null ? String(client.Country.Id) : null}
                onChange={(value) => {
                  const next = props.countries.find((country) => String(country.Id) === value) || undefined
                  props.onChange('Country', next)
                }}
              />
              <NewCountryControl onCreate={props.onCreateCountry} />
            </Group>
          </SimpleGrid>
        </Stack>
      </Card>
    </Stack>
  )
}

function BuyerFields(props: GeneralInfoFieldsProps) {
  const { t } = useI18n()
  const { client, role } = props
  const hasRegion = Boolean(client.Region && (client.Region.Id || 0) > 0)

  return (
    <Stack gap="md">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text fw={600}>{t('Реквізити покупця')}</Text>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <TextInput
              label={t('Прізвище')}
              value={client.LastName || ''}
              onChange={(event) => props.onChange('LastName', event.currentTarget.value)}
            />
            <TextInput
              label={t("Ім'я")}
              value={client.FirstName || ''}
              onChange={(event) => props.onChange('FirstName', event.currentTarget.value)}
            />
            <TextInput
              label={t('По батькові')}
              value={client.MiddleName || ''}
              onChange={(event) => props.onChange('MiddleName', event.currentTarget.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <TextInput
              error={props.errors?.SROI}
              label={t('Номер платника ПДВ')}
              maxLength={30}
              value={client.SROI || ''}
              onChange={(event) => props.onChange('SROI', event.currentTarget.value)}
            />
            <TextInput
              error={props.errors?.TIN}
              label={t('ІПН')}
              maxLength={30}
              value={client.TIN || ''}
              onChange={(event) => props.onChange('TIN', event.currentTarget.value)}
            />
            <TextInput
              error={props.errors?.USREOU}
              label={t('ЄДРПОУ')}
              maxLength={30}
              value={client.USREOU || ''}
              onChange={(event) => props.onChange('USREOU', event.currentTarget.value)}
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {(!role.isSubClient || !client.IsSubClient) && (
        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap="md">
            <Text fw={600}>{t('Регіон')}</Text>
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <Select
                clearable
                searchable
                data={props.regions.map((region) => ({
                  value: String(region.Id),
                  label: region.Name || '',
                }))}
                label={t('Регіон')}
                placeholder={t('Оберіть регіон')}
                style={{ flex: '1 1 auto' }}
                value={client.Region?.Id != null && (client.Region.Id || 0) > 0 ? String(client.Region.Id) : null}
                onChange={(value) => {
                  const next = props.regions.find((region) => String(region.Id) === value) || null
                  props.onRegionChange(next)
                }}
              />
              {hasRegion && (
                <ActionIcon
                  aria-label={t('Видалити регіон')}
                  color="red"
                  size="lg"
                  variant="light"
                  onClick={() => props.onRegionChange(null)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
              <NewRegionControl onCreate={props.onCreateRegion} />
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <TextInput
                disabled={!hasRegion}
                error={props.regionCodeError}
                label={t('Код по регіону')}
                rightSection={props.isLoadingRegionCode ? <Text size="xs">…</Text> : undefined}
                value={resolveRegionCodeValue(client.RegionCode, 'Value')}
                onChange={(event) => props.onRegionCodeFieldChange('Value', event.currentTarget.value)}
              />
              <TextInput
                disabled={!hasRegion}
                label={t('Місто')}
                value={resolveRegionCodeValue(client.RegionCode, 'City')}
                onChange={(event) => props.onRegionCodeFieldChange('City', event.currentTarget.value)}
              />
              <TextInput
                disabled={!hasRegion}
                label={t('Район')}
                value={resolveRegionCodeValue(client.RegionCode, 'District')}
                onChange={(event) => props.onRegionCodeFieldChange('District', event.currentTarget.value)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text fw={600}>{t('Тип клієнта')}</Text>
          {role.isSubClient ? (
            <SegmentedControl
              data={[
                { value: 'trade-point', label: t('Торгова точка') },
                { value: 'sub-client', label: t('Субклієнт') },
              ]}
              value={client.IsSubClient ? 'sub-client' : 'trade-point'}
              onChange={(value) => {
                const isSubClient = value === 'sub-client'
                props.onChange('IsSubClient', isSubClient)
                props.onChange('IsTradePoint', !isSubClient)
              }}
            />
          ) : (
            <Switch
              checked={Boolean(client.IsIndividual)}
              label={client.IsIndividual ? t('Фізична особа') : t('Юридична особа')}
              onChange={(event) => props.onChange('IsIndividual', event.currentTarget.checked)}
            />
          )}
        </Stack>
      </Card>

      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Text fw={600}>{t('Документи договору')}</Text>
          <ContractDocuments
            canSave={props.canSaveDocuments !== false}
            documents={client.ClientContractDocuments || []}
            isUploading={props.isUploadingDocuments}
            onAdd={props.onAddDocuments}
            onRemove={props.onRemoveDocument}
            onSave={props.onSaveDocuments}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function ContractDocuments({
  documents,
  isUploading,
  canSave,
  onAdd,
  onRemove,
  onSave,
}: {
  documents: ClientContractDocument[]
  isUploading?: boolean
  canSave: boolean
  onAdd: (files: File[]) => void
  onRemove: (document: ClientContractDocument) => void
  onSave: () => void
}) {
  const { t } = useI18n()
  const visibleDocuments = documents.filter((document) => !document.Deleted)

  return (
    <Stack gap="xs">
      <FileButton multiple onChange={(files) => files.length > 0 && onAdd(files)}>
        {(buttonProps) => (
          <Button color="gray" variant="light" {...buttonProps}>
            {t('Завантажити документи договору')}
          </Button>
        )}
      </FileButton>

      {visibleDocuments.map((document, index) => (
        <Group key={document.NetUid || document.Id || `${document.FileName}-${index}`} justify="space-between">
          <Text size="sm">{document.FileName || document.GeneratedName}</Text>
          <ActionIcon
            aria-label={t('Видалити')}
            color="red"
            variant="subtle"
            onClick={() => onRemove(document)}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
      ))}

      {canSave && visibleDocuments.length > 0 && (
        <Group justify="flex-end">
          <Button color={CREATE_ACTION_COLOR} loading={isUploading} onClick={onSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      )}
    </Stack>
  )
}

function NewIncotermControl({ onCreate }: { onCreate: (name: string) => void }) {
  const { t } = useI18n()
  const [isOpen, setOpen] = useState(false)
  const [name, setName] = useState('')

  return (
    <Popover opened={isOpen} position="bottom-end" shadow="md" trapFocus width={300} withArrow withinPortal onChange={setOpen}>
      <Popover.Target>
        <ActionIcon aria-label={t('Додати Incoterms')} color={CREATE_ACTION_COLOR} size="lg" variant="outline" onClick={() => setOpen(!isOpen)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <TextInput label={t('Назва')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <Group gap="xs" justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!name.trim()}
              onClick={() => {
                onCreate(name.trim())
                setName('')
                setOpen(false)
              }}
            >
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function NewCountryControl({ onCreate }: { onCreate: (name: string, code: string) => void }) {
  const { t } = useI18n()
  const [isOpen, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  return (
    <Popover opened={isOpen} position="bottom-end" shadow="md" trapFocus width={300} withArrow withinPortal onChange={setOpen}>
      <Popover.Target>
        <ActionIcon aria-label={t('Додати країну')} color={CREATE_ACTION_COLOR} size="lg" variant="outline" onClick={() => setOpen(!isOpen)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <TextInput label={t('Країна')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <TextInput label={t('Код країни')} maxLength={25} value={code} onChange={(event) => setCode(event.currentTarget.value)} />
          <Group gap="xs" justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!name.trim() || !code.trim()}
              onClick={() => {
                onCreate(name.trim(), code.trim())
                setName('')
                setCode('')
                setOpen(false)
              }}
            >
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function NewRegionControl({ onCreate }: { onCreate: (name: string) => void }) {
  const { t } = useI18n()
  const [isOpen, setOpen] = useState(false)
  const [name, setName] = useState('')

  return (
    <Popover opened={isOpen} position="bottom-end" shadow="md" trapFocus width={300} withArrow withinPortal onChange={setOpen}>
      <Popover.Target>
        <ActionIcon aria-label={t('Додати регіон')} color={CREATE_ACTION_COLOR} size="lg" variant="outline" onClick={() => setOpen(!isOpen)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <TextInput label={t('Регіон')} maxLength={20} value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <Group gap="xs" justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!name.trim()}
              onClick={() => {
                onCreate(name.trim())
                setName('')
                setOpen(false)
              }}
            >
              {t('Створити')}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function resolveRegionCodeValue(regionCode: RegionCode | undefined, key: 'Value' | 'City' | 'District'): string {
  return regionCode?.[key] || ''
}
