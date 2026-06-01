import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
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

      <Divider />

      <Group align="flex-end" gap="xs">
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

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
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
        <Group align="flex-end" gap="xs">
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
  )
}

function BuyerFields(props: GeneralInfoFieldsProps) {
  const { t } = useI18n()
  const { client, role } = props
  const hasRegion = Boolean(client.Region && (client.Region.Id || 0) > 0)

  return (
    <Stack gap="md">
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
          label={t('Номер платника ПДВ')}
          value={client.SROI || ''}
          onChange={(event) => props.onChange('SROI', event.currentTarget.value)}
        />
        <TextInput
          label={t('ІПН')}
          value={client.TIN || ''}
          onChange={(event) => props.onChange('TIN', event.currentTarget.value)}
        />
        <TextInput
          label={t('ЄДРПОУ')}
          value={client.USREOU || ''}
          onChange={(event) => props.onChange('USREOU', event.currentTarget.value)}
        />
      </SimpleGrid>

      {(!role.isSubClient || !client.IsSubClient) && (
        <>
          <Group align="flex-end" gap="xs">
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
        </>
      )}

      <Divider />

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

      <ContractDocuments
        canSave={props.canSaveDocuments !== false}
        documents={client.ClientContractDocuments || []}
        isUploading={props.isUploadingDocuments}
        onAdd={props.onAddDocuments}
        onRemove={props.onRemoveDocument}
        onSave={props.onSaveDocuments}
      />
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
          <Button color="violet" loading={isUploading} variant="light" onClick={onSave}>
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

  if (!isOpen) {
    return (
      <ActionIcon aria-label={t('Додати Incoterms')} color="violet" size="lg" variant="light" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
      </ActionIcon>
    )
  }

  return (
    <Group align="flex-end" gap="xs">
      <TextInput label={t('Назва')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <Button
        color="violet"
        disabled={!name.trim()}
        onClick={() => {
          onCreate(name.trim())
          setName('')
          setOpen(false)
        }}
      >
        {t('Створити')}
      </Button>
      <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
        {t('Скасувати')}
      </Button>
    </Group>
  )
}

function NewCountryControl({ onCreate }: { onCreate: (name: string, code: string) => void }) {
  const { t } = useI18n()
  const [isOpen, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  if (!isOpen) {
    return (
      <ActionIcon aria-label={t('Додати країну')} color="violet" size="lg" variant="light" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
      </ActionIcon>
    )
  }

  return (
    <Group align="flex-end" gap="xs">
      <TextInput label={t('Країна')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <TextInput label={t('Код країни')} maxLength={25} value={code} onChange={(event) => setCode(event.currentTarget.value)} />
      <Button
        color="violet"
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
      <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
        {t('Скасувати')}
      </Button>
    </Group>
  )
}

function NewRegionControl({ onCreate }: { onCreate: (name: string) => void }) {
  const { t } = useI18n()
  const [isOpen, setOpen] = useState(false)
  const [name, setName] = useState('')

  if (!isOpen) {
    return (
      <ActionIcon aria-label={t('Додати регіон')} color="violet" size="lg" variant="light" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
      </ActionIcon>
    )
  }

  return (
    <Group align="flex-end" gap="xs">
      <TextInput label={t('Регіон')} maxLength={20} value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <Button
        color="violet"
        disabled={!name.trim()}
        onClick={() => {
          onCreate(name.trim())
          setName('')
          setOpen(false)
        }}
      >
        {t('Створити')}
      </Button>
      <Button color="gray" variant="subtle" onClick={() => setOpen(false)}>
        {t('Скасувати')}
      </Button>
    </Group>
  )
}

function resolveRegionCodeValue(regionCode: RegionCode | undefined, key: 'Value' | 'City' | 'District'): string {
  return regionCode?.[key] || ''
}
