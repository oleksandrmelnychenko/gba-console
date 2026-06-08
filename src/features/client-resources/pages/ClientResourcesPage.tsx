import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowDown,
  IconArrowUp,
  IconBuilding,
  IconChevronRight,
  IconCoin,
  IconDatabaseOff,
  IconDeviceFloppy,
  IconExternalLink,
  IconMapPin,
  IconPackage,
  IconPencil,
  IconPlus,
  IconReceiptTax,
  IconRefresh,
  IconRulerMeasure,
  IconSearch,
  IconStar,
  IconTrash,
  IconTruck,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react'
import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePageBreadcrumb } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout, DataTableDensity } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import {
  changeClientResourcePricingPriority,
  createClientResourceCurrency,
  createClientResourceMeasureUnit,
  createClientResourceOrganization,
  createClientResourcePerfectClient,
  createClientResourcePricing,
  createClientResourceRegion,
  createClientResourceRegionCode,
  createClientResourceStorage,
  createClientResourceTaxInspection,
  createClientResourceTransporter,
  deleteClientResourceCurrency,
  deleteClientResourceMeasureUnit,
  deleteClientResourceOrganization,
  deleteClientResourcePerfectClient,
  deleteClientResourcePricing,
  deleteClientResourceRegion,
  deleteClientResourceRegionCode,
  deleteClientResourceStorage,
  deleteClientResourceTaxInspection,
  deleteClientResourceTransporter,
  getClientResourceBasePricings,
  getClientResourceClientTypes,
  getClientResourceCurrencies,
  getClientResourceMeasureUnits,
  getClientResourceOrganizations,
  getClientResourcePerfectClients,
  getClientResourcePricings,
  getClientResourcePricingTypes,
  getClientResourceRegions,
  getClientResourceStorages,
  getClientResourceTaxInspections,
  getClientResourceTransporterTypes,
  getClientResourceTransporters,
  getClientResourceVatRates,
  updateClientResourceClientTypeRole,
  updateClientResourceCurrency,
  updateClientResourceMeasureUnit,
  updateClientResourceOrganization,
  updateClientResourcePerfectClient,
  updateClientResourcePricing,
  updateClientResourceRegion,
  updateClientResourceRegionCode,
  updateClientResourceStorage,
  updateClientResourceTaxInspection,
  updateClientResourceTransporter,
} from '../api/clientResourcesApi'
import type {
  ClientResourceClientType,
  ClientResourceClientTypeRole,
  ClientResourceCurrency,
  ClientResourceEntity,
  ClientResourceMeasureUnit,
  ClientResourceOrganization,
  ClientResourcePerfectClient,
  ClientResourcePerfectClientValue,
  ClientResourcePricing,
  ClientResourcePricingType,
  ClientResourceRegion,
  ClientResourceRegionCode,
  ClientResourceStorage,
  ClientResourceTaxInspection,
  ClientResourceTranslation,
  ClientResourceTransporter,
  ClientResourceTransporterType,
  ClientResourceStep,
  ClientResourceValueTranslation,
  ClientResourceVatRate,
} from '../types'
import { CLIENT_RESOURCE_STEPS } from '../types'
import './clientResources.css'

const DEFAULT_STEP: ClientResourceStep = 'regions'
const BUYER_CLIENT_TYPE = 0
const PERFECT_CLIENT_CHECKBOX_TYPE = 1
const PERFECT_CLIENT_TOGGLE_TYPE = 2
const PROTECTED_TRANSPORTER_CSS_CLASS = 'self_checkout_item_class'
const REGION_CREATE_PERMISSION = 'REGIONS_ClientsResources_NewRegionBtn_PKEY'
const REGION_CODE_CREATE_PERMISSION = 'REGIONS_ClientsResources_NewBtn_PKEY'
const REGION_EDIT_PERMISSION = 'REGIONS_ClientsResources_EditBtn_PKEY'
const REGION_DELETE_PERMISSION = 'REGIONS_ClientsResources_DeleteBtn_PKEY'
const ORGANIZATION_CREATE_PERMISSION = 'ORGANIZATIONS_ClientsResources_NewBtn_PKEY'
const ORGANIZATION_EDIT_PERMISSION = 'ORGANIZATIONS_ClientsResources_EditBtn_PKEY'
const ORGANIZATION_DELETE_PERMISSION = 'ORGANIZATIONS_ClientsResources_DeleteBtn_PKEY'
const TAX_INSPECTION_CREATE_PERMISSION = 'TAX_INSPECTATION_ClientsResources_NewRowBtn_PKEY'
const TAX_INSPECTION_EDIT_PERMISSION = 'TAX_INSPECTATION_ClientsResources_EditRowBtn_PKEY'
const TAX_INSPECTION_DELETE_PERMISSION = 'TAX_INSPECTATION_ClientsResources_DeleteBtn_PKEY'
const PRICING_CREATE_PERMISSION = 'PRICING_ClientsResources_NewBtn_PKEY'
const PRICING_EDIT_PERMISSION = 'PRICING_ClientsResources_EditBtn_PKEY'
const PRICING_DELETE_PERMISSION = 'PRICING_ClientsResources_DeleteBtn_PKEY'
const PRICING_PRIORITY_PERMISSION = 'PRICING_ClientsResources_Priority_PKEY'
const CURRENCY_CREATE_PERMISSION = 'CURRENCIES_ClientsResources_NewBtn_PKEY'
const CURRENCY_EDIT_PERMISSION = 'CURRENCIES_ClientsResources_EditBtn_PKEY'
const CURRENCY_DELETE_PERMISSION = 'CURRENCIES_ClientsResources_DeleteBtn_PKEY'
const STORAGE_CREATE_PERMISSION = 'STORAGES_ClientsResources_NewBtn_PKEY'
const STORAGE_EDIT_PERMISSION = 'STORAGES_ClientsResources_EditBtn_PKEY'
const STORAGE_DELETE_PERMISSION = 'STORAGES_ClientsResources_DeleteBtn_PKEY'
const MEASURE_UNIT_CREATE_PERMISSION = 'MEASURE_UNIT_ClientsResources_NewBtn_PKEY'
const MEASURE_UNIT_EDIT_PERMISSION = 'MEASURE_UNIT_ClientsResources_EditBtn_PKEY'
const MEASURE_UNIT_DELETE_PERMISSION = 'MEASURE_UNIT_ClientsResources_DeleteBtn_PKEY'
const PERFECT_CLIENT_CREATE_PERMISSION = 'PERFECTCLIENT_ClientsResources_NewBtn_PKEY'
const PERFECT_CLIENT_EDIT_PERMISSION = 'PERFECTCLIENT_ClientsResources_EditBtn_PKEY'
const PERFECT_CLIENT_DELETE_PERMISSION = 'PERFECTCLIENT_ClientsResources_DeleteBtn_PKEY'
const UKRAINE_CULTURE = 'uk'
const SKIPPED_TRANSLATION_CULTURES = new Set(['pl'])
const TYPE_TAXATION_OPTIONS = [
  { value: '0', label: 'Єдиний податок' },
  { value: '1', label: 'Єдиний податок + ПДВ' },
  { value: '2', label: 'Податок на прибуток' },
  { value: '3', label: 'Податок на прибуток + ПДВ' },
  { value: '4', label: 'Не платник' },
]

type ResourceIcon = ComponentType<{ size?: number; stroke?: number }>

type ClientResourceSection = {
  description: string
  icon: ResourceIcon
  label: string
  step: ClientResourceStep
}

type ResourceLoadState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  reload: () => void
}

type ResourceState<T> = {
  data: T
  error: string | null
  isLoading: boolean
  revision: number
}

type ResourceAction<T> =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; data: T }
  | { type: 'loadFailed'; error: string }
  | { type: 'reload' }

const CLIENT_RESOURCE_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

type ResourceDataTableProps<TData extends ClientResourceEntity> = {
  columns: DataTableColumn<TData>[]
  data: TData[]
  density?: DataTableDensity
  emptyText?: ReactNode
  layoutVersion?: number | string
  minWidth?: number
  tableId: string
}

function ResourceDataTable<TData extends ClientResourceEntity>({
  columns,
  data,
  density,
  emptyText,
  layoutVersion = 'client-resources-table-2',
  minWidth = 760,
  tableId,
}: ResourceDataTableProps<TData>) {
  return (
    <DataTable
      columns={columns}
      data={data}
      defaultLayout={CLIENT_RESOURCE_TABLE_DEFAULT_LAYOUT}
      density={density}
      emptyText={emptyText}
      getRowId={(row, index) => getEntityKey(row, index)}
      layoutVersion={layoutVersion}
      maxHeight="min(56vh, 620px)"
      minWidth={minWidth}
      tableId={`client-resources-${normalizeTableIdPart(tableId)}`}
    />
  )
}

function TruncatedCell({ value }: { value: unknown }) {
  const text = displayValue(value)
  const hasTooltip = text && text !== '—'

  return (
    <Tooltip
      classNames={{ tooltip: 'client-resources-cell-tooltip' }}
      disabled={!hasTooltip}
      label={text}
      maw={420}
      multiline
      openDelay={350}
      position="top-start"
      withArrow
    >
      <Text component="span" className="client-resources-truncated-cell">
        {text}
      </Text>
    </Tooltip>
  )
}

type RegionEditorState = {
  mode: 'create' | 'edit'
  region?: ClientResourceRegion
}

type RegionCodeEditorState = {
  mode: 'create' | 'edit'
  region: ClientResourceRegion
  regionCode?: ClientResourceRegionCode
}

type RegionCodeFormValues = {
  City: string
  District: string
  Value: string
}

type ClientResourceDeleteTarget =
  | {
      type: 'region'
      region: ClientResourceRegion
    }
  | {
      type: 'regionCode'
      regionCode: ClientResourceRegionCode
    }
  | {
      type: 'organization'
      organization: ClientResourceOrganization
    }
  | {
      type: 'taxInspection'
      taxInspection: ClientResourceTaxInspection
    }
  | {
      type: 'pricing'
      pricing: ClientResourcePricing
    }
  | {
      type: 'currency'
      currency: ClientResourceCurrency
    }
  | {
      type: 'storage'
      storage: ClientResourceStorage
    }
  | {
      type: 'measureUnit'
      measureUnit: ClientResourceMeasureUnit
    }
  | {
      type: 'perfectClient'
      perfectClient: ClientResourcePerfectClient
    }
  | {
      type: 'transporter'
      transporter: ClientResourceTransporter
    }

type OrganizationEditorState = {
  mode: 'create' | 'edit'
  organization?: ClientResourceOrganization
}

type OrganizationFormValues = {
  Address: string
  Code: string
  CurrencyId: string
  FullName: string
  IsIndividual: boolean
  IsVatAgreements: boolean
  MainPaymentRegisterId: string
  Manager: string
  Name: string
  PFURegistrationDate: string
  PFURegistrationNumber: string
  PhoneNumber: string
  RegistrationDate: string
  RegistrationNumber: string
  SROI: string
  StorageId: string
  TIN: string
  TaxInspectionId: string
  TranslationName: string
  TypeTaxation: string
  USREOU: string
  VatRateId: string
}

type CurrencyEditorState = {
  currency?: ClientResourceCurrency
  mode: 'create' | 'edit'
}

type CurrencyFormValues = {
  Code: string
  Name: string
}

type TaxInspectionEditorState = {
  mode: 'create' | 'edit'
  taxInspection?: ClientResourceTaxInspection
}

type TaxInspectionFormValues = {
  InspectionAddress: string
  InspectionName: string
  InspectionNumber: string
  InspectionRegionCode: string
  InspectionRegionName: string
  InspectionType: string
  InspectionUSREOU: string
}

type PricingEditorState = {
  mode: 'create' | 'edit'
  pricing?: ClientResourcePricing
}

type PricingFormValues = {
  BasePricingId: string
  Comment: string
  CurrencyId: string
  ExtraCharge: string
  ForVat: boolean
  Name: string
  PriceTypeId: string
}

type StorageEditorState = {
  mode: 'create' | 'edit'
  storage?: ClientResourceStorage
}

type StorageFormValues = {
  AvailableForReSale: boolean
  ForDefective: boolean
  ForEcommerce: boolean
  ForVatProducts: boolean
  IsResale: boolean
  Name: string
  OrganizationId: string
  RetailPriority: string
}

type MeasureUnitEditorState = {
  measureUnit?: ClientResourceMeasureUnit
  mode: 'create' | 'edit'
}

type MeasureUnitFormValues = {
  CodeOneC: string
  Description: string
  Name: string
}

type PerfectClientEditorState = {
  mode: 'create' | 'edit'
  perfectClient?: ClientResourcePerfectClient
}

type PerfectClientFormValues = {
  Description: string
  Lable: string
  Name: string
  ToggleValueLeft: string
  ToggleValueRight: string
  Type: string
  Value: string
}

type ReserveEditorState = {
  role: ClientResourceClientTypeRole
}

type TransporterEditorState = {
  mode: 'create' | 'edit'
  transporter?: ClientResourceTransporter
}

type TransporterFormValues = {
  CssClass: string
  ImageUrl: string
  ImageFile: File | null
  Name: string
  Priority: string
}

const RESOURCE_SECTIONS: ClientResourceSection[] = [
  {
    step: 'regions',
    label: 'Регіони',
    description: 'Регіони та коди регіонів',
    icon: IconMapPin,
  },
  {
    step: 'perfect-clients',
    label: 'Ідеальний клієнт',
    description: 'Параметри за ролями клієнтів',
    icon: IconStar,
  },
  {
    step: 'organizations',
    label: 'Організації',
    description: 'Юридичні особи та реквізити',
    icon: IconBuilding,
  },
  {
    step: 'tax-inspectation',
    label: 'Податкові інспекції',
    description: 'Довідник інспекцій',
    icon: IconReceiptTax,
  },
  {
    step: 'pricing',
    label: 'Ціноутворення',
    description: 'Типи цін та націнки',
    icon: IconCoin,
  },
  {
    step: 'currencies',
    label: 'Валюти',
    description: 'Валютні довідники',
    icon: IconCoin,
  },
  {
    step: 'storages',
    label: 'Склади',
    description: 'Складські майданчики',
    icon: IconPackage,
  },
  {
    step: 'measure-unit',
    label: 'Одиниці виміру',
    description: 'Коди та назви одиниць',
    icon: IconRulerMeasure,
  },
  {
    step: 'product-reserve',
    label: 'Резерв товару',
    description: 'Дні резерву за ролями',
    icon: IconUsers,
  },
  {
    step: 'carrier',
    label: 'Перевізники',
    description: 'Типи та записи перевізників',
    icon: IconTruck,
  },
]

export function ClientResourcesPage() {
  const navigate = useNavigate()
  const { step } = useParams<{ step?: string }>()
  const activeStep = isClientResourceStep(step) ? step : DEFAULT_STEP
  const activeSection = getSection(activeStep)

  usePageBreadcrumb(translate(activeSection.label))

  useEffect(() => {
    if (!isClientResourceStep(step)) {
      navigate(`/clients/resources/${DEFAULT_STEP}`, { replace: true })
    }
  }, [navigate, step])

  return (
    <Box className="client-resources-page">
      <Box className="client-resources-shell">
        <ClientResourcesNav activeStep={activeStep} onNavigate={(nextStep) => navigate(`/clients/resources/${nextStep}`)} />

        <Box className="client-resources-content">
          <ClientResourceSectionContent section={activeSection} step={activeStep} />
        </Box>
      </Box>
    </Box>
  )
}

function ClientResourcesNav({
  activeStep,
  onNavigate,
}: {
  activeStep: ClientResourceStep
  onNavigate: (nextStep: ClientResourceStep) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap={4} className="client-resources-nav" component="nav">
      {RESOURCE_SECTIONS.map((section) => {
        const Icon = section.icon
        const isActive = section.step === activeStep

        return (
          <Button
            key={section.step}
            className="client-resources-nav-item"
            color={isActive ? CREATE_ACTION_COLOR : 'gray'}
            fullWidth
            justify="space-between"
            leftSection={<Icon size={18} stroke={1.8} />}
            onClick={() => onNavigate(section.step)}
            rightSection={isActive ? <IconChevronRight size={16} stroke={2} /> : undefined}
            size="sm"
            variant={isActive ? 'filled' : 'subtle'}
          >
            {t(section.label)}
          </Button>
        )
      })}
    </Stack>
  )
}

function ClientResourceSectionContent({ section, step }: { section: ClientResourceSection; step: ClientResourceStep }) {
  switch (step) {
    case 'regions':
      return <RegionsPanel section={section} />
    case 'perfect-clients':
      return <PerfectClientsPanel section={section} />
    case 'organizations':
      return <OrganizationsPanel section={section} />
    case 'tax-inspectation':
      return <TaxInspectionsPanel section={section} />
    case 'pricing':
      return <PricingPanel section={section} />
    case 'currencies':
      return <CurrenciesPanel section={section} />
    case 'storages':
      return <StoragesPanel section={section} />
    case 'measure-unit':
      return <MeasureUnitsPanel section={section} />
    case 'product-reserve':
      return <ProductReservePanel section={section} />
    case 'carrier':
      return <CarrierPanel section={section} />
    default:
      return null
  }
}

function useRegionsPanelModel(section: ClientResourceSection) {
  const state = useResourceData<ClientResourceRegion[]>(getClientResourceRegions, [])
  const [search, setSearch] = useValueState('')
  const [selectedRegionId, setSelectedRegionId] = useValueState<string | null>(null)
  const [regionEditor, setRegionEditor] = useValueState<RegionEditorState | null>(null)
  const [regionCodeEditor, setRegionCodeEditor] = useValueState<RegionCodeEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const filteredRegions = useMemo(
    () =>
      state.data.filter((region) =>
        matchesSearch(search, [
          region.Name,
          region.NetUid,
          ...(region.RegionCodes || []).flatMap((code) => [code.Value, code.City, code.District]),
        ]),
      ),
    [search, state.data],
  )
  const effectiveSelectedRegionId = selectedRegionId || (state.data.length ? getEntityKey(state.data[0]) : null)
  const selectedRegion = useMemo(
    () =>
      state.data.find((region) => getEntityKey(region) === effectiveSelectedRegionId)
      || filteredRegions[0]
      || state.data[0],
    [effectiveSelectedRegionId, filteredRegions, state.data],
  )
  const selectedRegionCodes = useMemo(() => {
    const codes = selectedRegion?.RegionCodes || []

    if (!search.trim() || matchesSearch(search, [selectedRegion?.Name, selectedRegion?.NetUid])) {
      return codes
    }

    return codes.filter((code) => matchesSearch(search, [code.Value, code.City, code.District]))
  }, [search, selectedRegion])

  function openCreateRegion() {
    setFormError(null)
    setRegionEditor({ mode: 'create' })
  }

  function openEditRegion(region: ClientResourceRegion) {
    setFormError(null)
    setRegionEditor({ mode: 'edit', region })
  }

  function openCreateRegionCode(region: ClientResourceRegion) {
    setFormError(null)
    setRegionCodeEditor({ mode: 'create', region })
  }

  function openEditRegionCode(region: ClientResourceRegion, regionCode: ClientResourceRegionCode) {
    setFormError(null)
    setRegionCodeEditor({ mode: 'edit', region, regionCode })
  }

  async function saveRegion(name: string) {
    const validationError = validateRegionName(name)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload: ClientResourceRegion = {
        ...(regionEditor?.region || {}),
        Name: name.trim(),
      }
      const savedRegion = regionEditor?.mode === 'edit'
        ? await updateClientResourceRegion(payload)
        : await createClientResourceRegion(payload)

      if (savedRegion?.NetUid) {
        setSelectedRegionId(savedRegion.NetUid)
      }

      notifications.show({ color: 'green', message: regionEditor?.mode === 'edit' ? translate('Регіон оновлено') : translate('Регіон створено') })
      setRegionEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти регіон'))
    } finally {
      setSaving(false)
    }
  }

  async function saveRegionCode(values: RegionCodeFormValues) {
    const validationError = validateRegionCode(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    if (!regionCodeEditor?.region.Id) {
      setFormError(translate('Регіон не має ID для створення коду'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload: ClientResourceRegionCode = {
        ...(regionCodeEditor.regionCode || {}),
        City: values.City.trim(),
        District: values.District.trim(),
        RegionId: regionCodeEditor.region.Id,
        Value: values.Value.trim(),
      }
      const savedRegionCode = regionCodeEditor.mode === 'edit'
        ? await updateClientResourceRegionCode(payload)
        : await createClientResourceRegionCode(payload)

      if (savedRegionCode?.RegionId) {
        setSelectedRegionId(getEntityKey(regionCodeEditor.region))
      }

      notifications.show({
        color: 'green',
        message: regionCodeEditor.mode === 'edit' ? translate('Код регіону оновлено') : translate('Код регіону створено'),
      })
      setRegionCodeEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти код регіону'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteRegionTarget() {
    if (!deleteTarget) {
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (deleteTarget.type === 'region') {
        const netId = deleteTarget.region.NetUid

        if (!netId) {
          throw new Error(translate('Регіон не має NetUid'))
        }

        await deleteClientResourceRegion(netId)
        setSelectedRegionId(null)
        notifications.show({ color: 'green', message: translate('Регіон видалено') })
      }

      if (deleteTarget.type === 'regionCode') {
        const netId = deleteTarget.regionCode.NetUid

        if (!netId) {
          throw new Error(translate('Код регіону не має NetUid'))
        }

        await deleteClientResourceRegionCode(netId)
        notifications.show({ color: 'green', message: translate('Код регіону видалено') })
      }

      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити запис'))
    } finally {
      setSaving(false)
    }
  }

  return {
    deleteTarget, filteredRegions, formError, isSaving, regionCodeEditor, regionEditor, search, section,
    selectedRegion, selectedRegionCodes, state, confirmDeleteRegionTarget, openCreateRegion, openCreateRegionCode, openEditRegion,
    openEditRegionCode, saveRegion, saveRegionCode, setDeleteTarget, setFormError, setRegionCodeEditor,
    setRegionEditor, setSearch, setSelectedRegionId,
  }
}

function RegionsPanel({ section }: { section: ClientResourceSection }) {
  const model = useRegionsPanelModel(section)

  return <RegionsPanelView model={model} />
}

function RegionsPanelView({ model }: { model: ReturnType<typeof useRegionsPanelModel> }) {
  const {
    deleteTarget, filteredRegions, formError, isSaving, regionCodeEditor, regionEditor, search, section,
    selectedRegion, selectedRegionCodes, state, confirmDeleteRegionTarget, openCreateRegion, openCreateRegionCode, openEditRegion,
    openEditRegionCode, saveRegion, saveRegionCode, setDeleteTarget, setFormError, setRegionCodeEditor,
    setRegionEditor, setSearch, setSelectedRegionId,
  } = model
  const regionHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={REGION_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateRegion}>
          Новий регіон
        </Button>
      </PermissionGate>
    </Group>
  )

  return (
    <ResourcePanel action={regionHeaderAction} section={section}>
      <Loadable state={state} emptyTitle="Регіонів не знайдено">
        {filteredRegions.length ? (
          <Box className="client-resources-regions-grid">
            <Stack gap={8} className="client-resources-region-master">
              <TextInput
                className="client-resources-region-search"
                leftSection={<IconSearch size={16} stroke={1.8} />}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={translate('Пошук')}
                value={search}
              />
              <Stack gap={8} className="client-resources-region-list">
                {filteredRegions.map((region, index) => {
                  const key = getEntityKey(region, index)
                  const isActive = getEntityKey(selectedRegion) === key

                  return (
                    <button
                      type="button"
                      className={`client-resources-region-row${isActive ? ' is-active' : ''}`}
                      key={key}
                      onClick={() => setSelectedRegionId(key)}
                    >
                      <span>
                        <Text fw={600}>{displayValue(region.Name)}</Text>
                      </span>
                      <Group gap={4} wrap="nowrap">
                        <Badge variant="light" color={isActive ? CREATE_ACTION_COLOR : 'gray'}>
                          {region.RegionCodes?.length || 0}
                        </Badge>
                        <PermissionGate permissionKey={REGION_CODE_CREATE_PERMISSION}>
                          <Tooltip label={translate("Додати код")}>
                            <ActionIcon
                              aria-label={translate("Додати код регіону")}
                              color={CREATE_ACTION_COLOR}
                              size="sm"
                              variant="subtle"
                              onClick={(event) => {
                                event.stopPropagation()
                                openCreateRegionCode(region)
                              }}
                            >
                              <IconPlus size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </PermissionGate>
                        <PermissionGate permissionKey={REGION_EDIT_PERMISSION}>
                          <Tooltip label={translate("Редагувати")}>
                            <ActionIcon
                              aria-label={translate("Редагувати регіон")}
                              color="gray"
                              size="sm"
                              variant="subtle"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEditRegion(region)
                              }}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </PermissionGate>
                        <PermissionGate permissionKey={REGION_DELETE_PERMISSION}>
                          <Tooltip label={translate("Видалити")}>
                            <ActionIcon
                              aria-label={translate("Видалити регіон")}
                              color="red"
                              disabled={!region.NetUid}
                              size="sm"
                              variant="subtle"
                              onClick={(event) => {
                                event.stopPropagation()
                                setFormError(null)
                                setDeleteTarget({ type: 'region', region })
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </PermissionGate>
                      </Group>
                    </button>
                  )
                })}
              </Stack>
            </Stack>
            <Box className="client-resources-region-detail">
              <Group justify="space-between" mb="sm">
                <div>
                  <Text fw={700}>{displayValue(selectedRegion?.Name)}</Text>
                  <Text size="xs" c="dimmed">
                    Коди регіону
                  </Text>
                </div>
                {selectedRegion ? (
                  <PermissionGate permissionKey={REGION_CODE_CREATE_PERMISSION}>
                    <Tooltip label={translate("Додати код регіону")}>
                      <ActionIcon
                        aria-label={translate("Додати код регіону")}
                        color={CREATE_ACTION_COLOR}
                        variant="light"
                        onClick={() => openCreateRegionCode(selectedRegion)}
                      >
                        <IconPlus size={17} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                ) : null}
              </Group>
              {selectedRegion && selectedRegionCodes.length ? (
                <ResourceDataTable
                  columns={[
                    {
                      id: 'code',
                      header: 'Код',
                      accessor: (code) => code.Value,
                      width: 140,
                    },
                    {
                      id: 'city',
                      header: 'Місто',
                      accessor: (code) => code.City,
                      minWidth: 180,
                    },
                    {
                      id: 'district',
                      header: 'Район',
                      accessor: (code) => code.District,
                      minWidth: 180,
                    },
                    {
                      id: 'actions',
                      header: '',
                      align: 'right',
                      width: 96,
                      enableHiding: false,
                      enableReorder: false,
                      enableResizing: false,
                      enableSorting: false,
                      cell: (code) => (
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <PermissionGate permissionKey={REGION_EDIT_PERMISSION}>
                            <Tooltip label={translate("Редагувати")}>
                              <ActionIcon
                                aria-label={translate("Редагувати код регіону")}
                                color="gray"
                                size="sm"
                                variant="subtle"
                                onClick={() => openEditRegionCode(selectedRegion, code)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </PermissionGate>
                          <PermissionGate permissionKey={REGION_DELETE_PERMISSION}>
                            <Tooltip label={translate("Видалити")}>
                              <ActionIcon
                                aria-label={translate("Видалити код регіону")}
                                color="red"
                                disabled={!code.NetUid}
                                size="sm"
                                variant="subtle"
                                onClick={() => {
                                  setFormError(null)
                                  setDeleteTarget({ type: 'regionCode', regionCode: code })
                                }}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </PermissionGate>
                        </Group>
                      ),
                    },
                  ]}
                  data={selectedRegionCodes}
                  emptyText={translate("Кодів регіону немає")}
                  minWidth={620}
                  tableId="region-codes"
                />
              ) : (
                <EmptyState title={translate(selectedRegion?.RegionCodes?.length ? "За цим пошуком кодів немає" : "Кодів регіону немає")} />
              )}
            </Box>
          </Box>
        ) : (
          <EmptyState title={translate("За цим пошуком немає регіонів")} />
        )}
      </Loadable>
      <RegionEditorModal
        key={regionEditor ? `region-${regionEditor.mode}-${getEntityKey(regionEditor.region)}` : 'region-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(regionEditor)}
        region={regionEditor?.region}
        title={regionEditor?.mode === 'edit' ? translate('Редагувати регіон') : translate('Новий регіон')}
        onClose={() => {
          if (!isSaving) {
            setRegionEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveRegion}
      />
      <RegionCodeEditorModal
        key={regionCodeEditor ? `region-code-${regionCodeEditor.mode}-${getEntityKey(regionCodeEditor.regionCode)}` : 'region-code-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(regionCodeEditor)}
        regionCode={regionCodeEditor?.regionCode}
        title={regionCodeEditor?.mode === 'edit' ? translate('Редагувати код регіону') : translate('Новий код регіону')}
        onClose={() => {
          if (!isSaving) {
            setRegionCodeEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveRegionCode}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={Boolean(deleteTarget)}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteRegionTarget}
      />
    </ResourcePanel>
  )
}

function RegionEditorModal({
  error,
  isSaving,
  opened,
  region,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  region?: ClientResourceRegion
  title: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useValueState(region?.Name || '')

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(name)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Назва")}
            maxLength={5}
            placeholder={translate("Назва")}
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              Скасувати
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              Зберегти
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function RegionCodeEditorModal({
  error,
  isSaving,
  opened,
  regionCode,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  regionCode?: ClientResourceRegionCode
  title: string
  onClose: () => void
  onSave: (values: RegionCodeFormValues) => void
}) {
  const [values, setValues] = useValueState<RegionCodeFormValues>(() => regionCodeToFormValues(regionCode))

  function setField<K extends keyof RegionCodeFormValues>(key: K, value: RegionCodeFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Код")}
            maxLength={10}
            required
            value={values.Value}
            onChange={(event) => setField('Value', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Місто")}
            value={values.City}
            onChange={(event) => setField('City', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Район")}
            value={values.District}
            onChange={(event) => setField('District', event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              Скасувати
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              Зберегти
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function DeleteResourceModal({
  error,
  isSaving,
  opened,
  target,
  onClose,
  onConfirm,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  target: ClientResourceDeleteTarget | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <AppModal centered opened={opened} title={translate("Видалити запис")} onClose={onClose}>
      <Stack gap="md">
        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
            {error}
          </Alert>
        ) : null}
        <Text size="sm">{getDeleteTargetMessage(target)}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
            Скасувати
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={onConfirm}>
            Видалити
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function PerfectClientsPanel({ section }: { section: ClientResourceSection }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientTypesState = useResourceData<ClientResourceClientType[]>(getClientResourceClientTypes, [])
  const [editor, setEditor] = useValueState<PerfectClientEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const buyerRoles = useMemo(() => getBuyerRoles(clientTypesState.data), [clientTypesState.data])
  const roleOptions = useMemo(() => getRoleSelectOptions(buyerRoles), [buyerRoles])
  const queryRoleId = searchParams.get('id')
  const roleOptionExists = roleOptions.some((option) => option.value === queryRoleId)
  const effectiveRoleId = roleOptionExists ? queryRoleId : roleOptions[0]?.value || null
  const selectedRole = useMemo(
    () => buyerRoles.find((role) => String(role.Id) === effectiveRoleId),
    [buyerRoles, effectiveRoleId],
  )
  const loadPerfectClients = useCallback(() => {
    const numericRoleId = Number(effectiveRoleId)

    if (!Number.isFinite(numericRoleId) || numericRoleId <= 0) {
      return Promise.resolve([] as ClientResourcePerfectClient[])
    }

    return getClientResourcePerfectClients(numericRoleId)
  }, [effectiveRoleId])
  const perfectClientsState = useResourceData<ClientResourcePerfectClient[]>(loadPerfectClients, [])
  const checkboxItems = perfectClientsState.data.filter((item) => item.Type === PERFECT_CLIENT_CHECKBOX_TYPE)
  const toggleItems = perfectClientsState.data.filter((item) => item.Type === PERFECT_CLIENT_TOGGLE_TYPE)

  function selectRole(nextRoleId: string | null) {
    const normalizedRoleId = nextRoleId || roleOptions[0]?.value || null

    setFormError(null)
    setEditor(null)
    setDeleteTarget(null)

    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      if (normalizedRoleId) {
        nextParams.set('id', normalizedRoleId)
      } else {
        nextParams.delete('id')
      }

      return nextParams
    })
  }

  function openCreatePerfectClient() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditPerfectClient(perfectClient: ClientResourcePerfectClient) {
    setFormError(null)
    setEditor({ mode: 'edit', perfectClient })
  }

  async function savePerfectClient(values: PerfectClientFormValues) {
    if (!selectedRole?.Id) {
      setFormError(translate('Оберіть роль клієнта'))
      return
    }

    const validationError = validatePerfectClientForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildPerfectClientPayload(editor?.perfectClient, values, selectedRole)

      if (editor?.mode === 'edit') {
        await updateClientResourcePerfectClient(payload)
      } else {
        await createClientResourcePerfectClient(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Параметр оновлено') : translate('Параметр створено'),
      })
      setEditor(null)
      perfectClientsState.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти параметр'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePerfectClient() {
    if (deleteTarget?.type !== 'perfectClient') {
      return
    }

    const netId = deleteTarget.perfectClient.NetUid

    if (!netId) {
      setFormError(translate('Параметр не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourcePerfectClient(netId)
      notifications.show({ color: 'green', message: translate('Параметр видалено') })
      setDeleteTarget(null)
      perfectClientsState.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити параметр'))
    } finally {
      setSaving(false)
    }
  }

  const perfectClientAction = (
    <Group gap="xs" wrap="nowrap">
      <Select
        allowDeselect={false}
        data={roleOptions}
        disabled={!roleOptions.length || clientTypesState.isLoading}
        placeholder={translate("Оберіть роль")}
        size="xs"
        value={effectiveRoleId}
        w={220}
        onChange={selectRole}
      />
      <RefreshControl
        isLoading={clientTypesState.isLoading || perfectClientsState.isLoading}
        onRefresh={() => {
          clientTypesState.reload()
          perfectClientsState.reload()
        }}
      />
      <PermissionGate permissionKey={PERFECT_CLIENT_CREATE_PERMISSION}>
        <Button
          color="violet"
          disabled={!selectedRole}
          leftSection={<IconPlus size={16} />}
          size="xs"
          onClick={openCreatePerfectClient}
        >
          Параметр
        </Button>
      </PermissionGate>
    </Group>
  )

  return (
    <ResourcePanel action={perfectClientAction} section={section}>
      <Loadable state={clientTypesState} emptyTitle="Ролей клієнтів не знайдено">
        <Loadable state={perfectClientsState} emptyTitle="Параметрів для ролі не знайдено">
          {selectedRole ? (
            <Box className="client-resources-perfect-client-grid">
              <PerfectClientGroup
                items={checkboxItems}
                title={translate("Прапорці")}
                onDelete={(perfectClient) => {
                  setFormError(null)
                  setDeleteTarget({ type: 'perfectClient', perfectClient })
                }}
                onEdit={openEditPerfectClient}
              />
              <PerfectClientGroup
                items={toggleItems}
                title={translate("Перемикачі")}
                onDelete={(perfectClient) => {
                  setFormError(null)
                  setDeleteTarget({ type: 'perfectClient', perfectClient })
                }}
                onEdit={openEditPerfectClient}
              />
            </Box>
          ) : (
            <EmptyState title={translate("Параметрів немає")} />
          )}
        </Loadable>
      </Loadable>
      <PerfectClientEditorModal
        key={editor ? `perfect-client-${editor.mode}-${getEntityKey(editor.perfectClient)}` : 'perfect-client-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        perfectClient={editor?.perfectClient}
        title={editor?.mode === 'edit' ? translate('Редагувати параметр') : translate('Новий параметр')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={savePerfectClient}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'perfectClient'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeletePerfectClient}
      />
    </ResourcePanel>
  )
}

function PerfectClientGroup({
  items,
  title,
  onDelete,
  onEdit,
}: {
  items: ClientResourcePerfectClient[]
  title: string
  onDelete: (perfectClient: ClientResourcePerfectClient) => void
  onEdit: (perfectClient: ClientResourcePerfectClient) => void
}) {
  return (
    <Box className="client-resources-perfect-client-column" aria-label={title}>
      {items.length ? (
        <Stack gap={0}>
          {items.map((item) => {
            const name = displayTranslatedEntity(item.Name, item.PerfectClientTranslations)
            const description = item.Description?.trim() || displayValue(item.Lable)

            return (
              <Box className="client-resources-perfect-client-row" key={getEntityKey(item)}>
                <Box className="client-resources-perfect-client-text">
                  <Tooltip classNames={{ tooltip: 'client-resources-cell-tooltip' }} label={name} disabled={!name || name === '-'}>
                    <Text className="client-resources-perfect-client-name">{name}</Text>
                  </Tooltip>
                  <Tooltip
                    classNames={{ tooltip: 'client-resources-cell-tooltip' }}
                    label={description}
                    disabled={!description || description === '-'}
                  >
                    <Text className="client-resources-perfect-client-description">{description}</Text>
                  </Tooltip>
                </Box>
                <Group gap={6} justify="flex-end" wrap="nowrap">
                  <PermissionGate permissionKey={PERFECT_CLIENT_EDIT_PERMISSION}>
                    <Tooltip label={translate("Редагувати")}>
                      <ActionIcon
                        aria-label={translate("Редагувати параметр")}
                        color="gray"
                        size="sm"
                        variant="default"
                        onClick={() => onEdit(item)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                  <PermissionGate permissionKey={PERFECT_CLIENT_DELETE_PERMISSION}>
                    <Tooltip label={translate("Видалити")}>
                      <ActionIcon
                        aria-label={translate("Видалити параметр")}
                        color="red"
                        disabled={!item.NetUid}
                        size="sm"
                        variant="default"
                        onClick={() => onDelete(item)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                </Group>
              </Box>
            )
          })}
        </Stack>
      ) : (
        <EmptyState title={translate("Записів немає")} />
      )}
    </Box>
  )
}

function PerfectClientEditorModal({
  error,
  isSaving,
  opened,
  perfectClient,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  perfectClient?: ClientResourcePerfectClient
  title: string
  onClose: () => void
  onSave: (values: PerfectClientFormValues) => void
}) {
  const [values, setValues] = useValueState<PerfectClientFormValues>(() => perfectClientToFormValues(perfectClient))

  function setField<K extends keyof PerfectClientFormValues>(key: K, value: PerfectClientFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Назва")}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <Select
            allowDeselect={false}
            data={[
              { value: String(PERFECT_CLIENT_CHECKBOX_TYPE), label: translate('Не існує') },
              { value: String(PERFECT_CLIENT_TOGGLE_TYPE), label: translate('Існує') },
            ]}
            label={translate("Тип")}
            value={values.Type}
            onChange={(value) => setField('Type', value || String(PERFECT_CLIENT_TOGGLE_TYPE))}
          />
          <TextInput
            label={translate("Мітка")}
            value={values.Lable}
            onChange={(event) => setField('Lable', event.currentTarget.value)}
          />
          {Number(values.Type) === PERFECT_CLIENT_TOGGLE_TYPE ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label={translate("Значення ліворуч")}
                required
                value={values.ToggleValueLeft}
                onChange={(event) => setField('ToggleValueLeft', event.currentTarget.value)}
              />
              <TextInput
                label={translate("Значення праворуч")}
                required
                value={values.ToggleValueRight}
                onChange={(event) => setField('ToggleValueRight', event.currentTarget.value)}
              />
            </SimpleGrid>
          ) : (
            <TextInput
              label={translate("Значення")}
              value={values.Value}
              onChange={(event) => setField('Value', event.currentTarget.value)}
            />
          )}
          <TextInput
            label={translate("Опис")}
            value={values.Description}
            onChange={(event) => setField('Description', event.currentTarget.value)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function TaxInspectionEditorModal({
  error,
  isSaving,
  opened,
  taxInspection,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  taxInspection?: ClientResourceTaxInspection
  title: string
  onClose: () => void
  onSave: (values: TaxInspectionFormValues) => void
}) {
  const [values, setValues] = useValueState<TaxInspectionFormValues>(() => taxInspectionToFormValues(taxInspection))

  function setField<K extends keyof TaxInspectionFormValues>(key: K, value: TaxInspectionFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} size="lg" title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              autoFocus
              label={translate("Назва")}
              value={values.InspectionName}
              onChange={(event) => setField('InspectionName', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Код ГНИ")}
              value={values.InspectionNumber}
              onChange={(event) => setField('InspectionNumber', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Тип ГНИ")}
              value={values.InspectionType}
              onChange={(event) => setField('InspectionType', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Назва адм.района")}
              value={values.InspectionRegionName}
              onChange={(event) => setField('InspectionRegionName', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Код адм.района")}
              value={values.InspectionRegionCode}
              onChange={(event) => setField('InspectionRegionCode', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Код по ЄДРПОУ")}
              value={values.InspectionUSREOU}
              onChange={(event) => setField('InspectionUSREOU', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Адреса")}
              value={values.InspectionAddress}
              onChange={(event) => setField('InspectionAddress', event.currentTarget.value)}
            />
          </SimpleGrid>
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function PricingEditorModal({
  basePricings,
  currencies,
  error,
  isSaving,
  opened,
  priceTypes,
  pricing,
  title,
  onClose,
  onSave,
}: {
  basePricings: ClientResourcePricing[]
  currencies: ClientResourceCurrency[]
  error: string | null
  isSaving: boolean
  opened: boolean
  priceTypes: ClientResourcePricingType[]
  pricing?: ClientResourcePricing
  title: string
  onClose: () => void
  onSave: (values: PricingFormValues) => void
}) {
  const [values, setValues] = useValueState<PricingFormValues>(() =>
    pricingToFormValues(pricing, { basePricings, currencies, priceTypes }),
  )
  const selectedPriceType = findEntityById(priceTypes, values.PriceTypeId) || pricing?.PriceType
  const showCalculatedPriceOptions = shouldShowCalculatedPriceOptions(selectedPriceType, pricing)

  function setField<K extends keyof PricingFormValues>(key: K, value: PricingFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} size="lg" title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              autoFocus
              label={translate("Назва")}
              required
              value={values.Name}
              onChange={(event) => setField('Name', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Коментар")}
              value={values.Comment}
              onChange={(event) => setField('Comment', event.currentTarget.value)}
            />
            <Select
              allowDeselect={false}
              data={toEntityOptions(currencies, (currency) => displayCurrency(currency))}
              label={translate("Валюта")}
              value={values.CurrencyId}
              onChange={(value) => setField('CurrencyId', value || toOptionalEntityId(currencies[0]?.Id))}
            />
            <Select
              allowDeselect={false}
              data={toEntityOptions(priceTypes, (priceType) => displayValue(priceType.Name))}
              label={translate("Тип ціни")}
              value={values.PriceTypeId}
              onChange={(value) => {
                const nextPriceTypeId = value || toOptionalEntityId(priceTypes[0]?.Id)
                const nextPriceType = findEntityById(priceTypes, nextPriceTypeId)

                setValues((currentValues) => ({
                  ...currentValues,
                  BasePricingId: shouldShowCalculatedPriceOptions(nextPriceType, pricing)
                    ? currentValues.BasePricingId || toOptionalEntityId(basePricings[0]?.Id)
                    : '',
                  ExtraCharge: shouldShowCalculatedPriceOptions(nextPriceType, pricing) ? currentValues.ExtraCharge : '0',
                  PriceTypeId: nextPriceTypeId,
                }))
              }}
            />
            {showCalculatedPriceOptions ? (
              <>
                <Select
                  allowDeselect={false}
                  data={toEntityOptions(basePricings, (basePricing) =>
                    displayTranslatedEntity(basePricing.Name, basePricing.PricingTranslations),
                  )}
                  label={translate("Базова ціна")}
                  value={values.BasePricingId}
                  onChange={(value) => setField('BasePricingId', value || toOptionalEntityId(basePricings[0]?.Id))}
                />
                <TextInput
                  label={translate("Націнка, %")}
                  type="number"
                  value={values.ExtraCharge}
                  onChange={(event) => setField('ExtraCharge', event.currentTarget.value)}
                />
              </>
            ) : null}
          </SimpleGrid>
          <Checkbox
            checked={values.ForVat}
            label={translate("Для ПДВ")}
            onChange={(event) => setField('ForVat', event.currentTarget.checked)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function CurrencyEditorModal({
  currency,
  error,
  isSaving,
  opened,
  title,
  onClose,
  onSave,
}: {
  currency?: ClientResourceCurrency
  error: string | null
  isSaving: boolean
  opened: boolean
  title: string
  onClose: () => void
  onSave: (values: CurrencyFormValues) => void
}) {
  const [values, setValues] = useValueState<CurrencyFormValues>(() => currencyToFormValues(currency))

  function setField<K extends keyof CurrencyFormValues>(key: K, value: CurrencyFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Назва")}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Код")}
            value={values.Code}
            onChange={(event) => setField('Code', event.currentTarget.value)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function StorageEditorModal({
  error,
  isSaving,
  opened,
  organizations,
  storage,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  organizations: ClientResourceOrganization[]
  storage?: ClientResourceStorage
  title: string
  onClose: () => void
  onSave: (values: StorageFormValues) => void
}) {
  const [values, setValues] = useValueState<StorageFormValues>(() => storageToFormValues(storage))

  function setField<K extends keyof StorageFormValues>(key: K, value: StorageFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  function setForVatProducts(value: boolean) {
    setValues((currentValues) => ({
      ...currentValues,
      AvailableForReSale: value ? currentValues.AvailableForReSale : false,
      ForVatProducts: value,
    }))
  }

  return (
    <AppModal centered opened={opened} size="lg" title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              autoFocus
              label={translate("Назва")}
              required
              value={values.Name}
              onChange={(event) => setField('Name', event.currentTarget.value)}
            />
            <Select
              clearable
              data={toEntityOptions(organizations, (organization) =>
                displayTranslatedEntity(organization.Name, organization.OrganizationTranslations),
              )}
              label={translate("Організація")}
              value={values.OrganizationId}
              onChange={(value) => setField('OrganizationId', value || '')}
            />
            <TextInput
              label={translate("Пріоритет")}
              type="number"
              value={values.RetailPriority}
              onChange={(event) => setField('RetailPriority', event.currentTarget.value)}
            />
          </SimpleGrid>
          <Group gap="xl">
            <Checkbox
              checked={values.ForDefective}
              label={translate("Брак")}
              onChange={(event) => setField('ForDefective', event.currentTarget.checked)}
            />
            <Checkbox
              checked={values.ForVatProducts}
              label={translate("ПДВ")}
              onChange={(event) => setForVatProducts(event.currentTarget.checked)}
            />
            <Checkbox
              checked={values.ForEcommerce}
              label={translate("Інтернет-магазин")}
              onChange={(event) => setField('ForEcommerce', event.currentTarget.checked)}
            />
            {values.ForVatProducts ? (
              <Checkbox
                checked={values.AvailableForReSale}
                label={translate("Для перепродажу")}
                onChange={(event) => setField('AvailableForReSale', event.currentTarget.checked)}
              />
            ) : null}
            <Checkbox
              checked={values.IsResale}
              label={translate("Склад повернень")}
              onChange={(event) => setField('IsResale', event.currentTarget.checked)}
            />
          </Group>
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function MeasureUnitEditorModal({
  error,
  isSaving,
  measureUnit,
  opened,
  title,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  measureUnit?: ClientResourceMeasureUnit
  opened: boolean
  title: string
  onClose: () => void
  onSave: (values: MeasureUnitFormValues) => void
}) {
  const [values, setValues] = useValueState<MeasureUnitFormValues>(() => measureUnitToFormValues(measureUnit))

  function setField<K extends keyof MeasureUnitFormValues>(key: K, value: MeasureUnitFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Код 1С")}
            value={values.CodeOneC}
            onChange={(event) => setField('CodeOneC', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Назва")}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Повна назва")}
            required
            value={values.Description}
            onChange={(event) => setField('Description', event.currentTarget.value)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function ReserveEditorModal({
  error,
  isSaving,
  opened,
  role,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  role?: ClientResourceClientTypeRole
  onClose: () => void
  onSave: (days: string) => void
}) {
  const [days, setDays] = useValueState(() => String(role?.OrderExpireDays ?? 0))

  return (
    <AppModal centered opened={opened} title={translate("Редагувати резерв")} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(days)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <Text size="sm" fw={600}>
            {displayValue(role?.Name)}
          </Text>
          <TextInput
            autoFocus
            label={translate("Днів резерву")}
            min={0}
            required
            type="number"
            value={days}
            onChange={(event) => setDays(event.currentTarget.value)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function TransporterEditorModal({
  error,
  isSaving,
  opened,
  title,
  transporter,
  onClose,
  onSave,
}: {
  error: string | null
  isSaving: boolean
  opened: boolean
  title: string
  transporter?: ClientResourceTransporter
  onClose: () => void
  onSave: (values: TransporterFormValues) => void
}) {
  const [values, setValues] = useValueState<TransporterFormValues>(() => transporterToFormValues(transporter))

  function setField<K extends keyof TransporterFormValues>(key: K, value: TransporterFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            autoFocus
            label={translate("Назва")}
            required
            value={values.Name}
            onChange={(event) => setField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={translate("Пріоритет")}
            type="number"
            value={values.Priority}
            onChange={(event) => setField('Priority', event.currentTarget.value)}
          />
          <TextInput
            label={translate("CSS клас")}
            value={values.CssClass}
            onChange={(event) => setField('CssClass', event.currentTarget.value)}
          />
          <TextInput
            label={translate("URL зображення")}
            value={values.ImageUrl}
            onChange={(event) => setField('ImageUrl', event.currentTarget.value)}
          />
          <FileInput
            accept="image/*"
            clearable
            label={translate("Зображення 40x40")}
            leftSection={<IconUpload size={16} />}
            value={values.ImageFile}
            onChange={(file) => setField('ImageFile', file)}
          />
          <ModalActions isSaving={isSaving} onClose={onClose} />
        </Stack>
      </form>
    </AppModal>
  )
}

function ModalActions({ isSaving, onClose }: { isSaving: boolean; onClose: () => void }) {
  return (
    <Group justify="flex-end">
      <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
        Скасувати
      </Button>
      <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
        Зберегти
      </Button>
    </Group>
  )
}

function OrganizationsPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceOrganization[]>(getClientResourceOrganizations, [])
  const currenciesState = useResourceData<ClientResourceCurrency[]>(getClientResourceCurrencies, [])
  const storagesState = useResourceData<ClientResourceStorage[]>(getClientResourceStorages, [])
  const taxInspectionsState = useResourceData<ClientResourceTaxInspection[]>(getClientResourceTaxInspections, [])
  const vatRatesState = useResourceData<ClientResourceVatRate[]>(getClientResourceVatRates, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<OrganizationEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-organizations', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((organization) =>
        matchesSearch(search, [
          organization.Name,
          organization.FullName,
          organization.Code,
          organization.USREOU,
          organization.TIN,
          organization.SROI,
          organization.PhoneNumber,
          organization.Address,
          ...getTranslationNames(organization.OrganizationTranslations),
        ]),
      ),
    [search, state.data],
  )
  const supportError = currenciesState.error || storagesState.error || taxInspectionsState.error || vatRatesState.error

  function openCreateOrganization() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditOrganization(organization: ClientResourceOrganization) {
    setFormError(null)
    setEditor({ mode: 'edit', organization })
  }

  async function saveOrganization(values: OrganizationFormValues) {
    const validationError = validateOrganizationForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildOrganizationPayload(editor?.organization, values, {
        currencies: currenciesState.data,
        storages: storagesState.data,
        taxInspections: taxInspectionsState.data,
        vatRates: vatRatesState.data,
      })
      const savedOrganization = editor?.mode === 'edit'
        ? await updateClientResourceOrganization(payload)
        : await createClientResourceOrganization(payload)

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Організацію оновлено') : translate('Організацію створено'),
      })
      setEditor(null)

      if (savedOrganization) {
        state.reload()
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти організацію'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteOrganization() {
    if (deleteTarget?.type !== 'organization') {
      return
    }

    const netId = deleteTarget.organization.NetUid

    if (!netId) {
      setFormError(translate('Організація не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceOrganization(netId)
      notifications.show({ color: 'green', message: translate('Організацію видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити організацію'))
    } finally {
      setSaving(false)
    }
  }
  const organizationHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={ORGANIZATION_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateOrganization}>
          Нова організація
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={organizationHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      {supportError ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} stroke={1.8} />} mb="md" variant="light">
          {supportError}
        </Alert>
      ) : null}
      <Loadable state={state} emptyTitle="Організацій не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'name',
                header: 'Назва',
                accessor: (organization) => displayTranslatedEntity(organization.Name, organization.OrganizationTranslations),
                cell: (organization) => (
                  <TruncatedCell value={displayTranslatedEntity(organization.Name, organization.OrganizationTranslations)} />
                ),
                maxWidth: 190,
                width: 190,
              },
              {
                id: 'fullName',
                header: 'Повна назва',
                accessor: (organization) => organization.FullName,
                cell: (organization) => <TruncatedCell value={organization.FullName} />,
                maxWidth: 230,
                width: 230,
              },
              {
                id: 'code',
                header: 'Код',
                accessor: (organization) => organization.Code,
                cell: (organization) => <TruncatedCell value={organization.Code} />,
                maxWidth: 80,
                width: 80,
              },
              {
                id: 'usreou',
                header: 'ЄДРПОУ',
                accessor: (organization) => organization.USREOU,
                cell: (organization) => <TruncatedCell value={organization.USREOU} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'tin',
                header: 'ІПН',
                accessor: (organization) => organization.TIN,
                cell: (organization) => <TruncatedCell value={organization.TIN} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'currency',
                header: 'Валюта',
                accessor: (organization) => displayCurrency(organization.Currency),
                cell: (organization) => <TruncatedCell value={displayCurrency(organization.Currency)} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'taxInspection',
                header: 'Податкова',
                accessor: (organization) => organization.TaxInspection?.InspectionName,
                cell: (organization) => <TruncatedCell value={organization.TaxInspection?.InspectionName} />,
                maxWidth: 170,
                width: 170,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (organization) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={ORGANIZATION_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати організацію")}
                          color="gray"
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditOrganization(organization)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permissionKey={ORGANIZATION_DELETE_PERMISSION}>
                      <Tooltip label={translate("Видалити")}>
                        <ActionIcon
                          aria-label={translate("Видалити організацію")}
                          color="red"
                          disabled={!organization.NetUid}
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setFormError(null)
                            setDeleteTarget({ type: 'organization', organization })
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                  </Group>
                ),
              },
            ]}
            data={filtered}
            density={density}
            emptyText={translate("За цим пошуком немає організацій")}
            layoutVersion="client-resources-organizations-table-2"
            minWidth={1102}
            tableId="organizations"
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає організацій")} />
        )}
      </Loadable>
      <OrganizationEditorModal
        key={editor ? `organization-${editor.mode}-${getEntityKey(editor.organization)}` : 'organization-closed'}
        currencies={currenciesState.data}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        organization={editor?.organization}
        storages={storagesState.data}
        taxInspections={taxInspectionsState.data}
        title={editor?.mode === 'edit' ? translate('Редагувати організацію') : translate('Нова організація')}
        vatRates={vatRatesState.data}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveOrganization}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={Boolean(deleteTarget)}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteOrganization}
      />
    </ResourcePanel>
  )
}

function OrganizationEditorModal({
  currencies,
  error,
  isSaving,
  opened,
  organization,
  storages,
  taxInspections,
  title,
  vatRates,
  onClose,
  onSave,
}: {
  currencies: ClientResourceCurrency[]
  error: string | null
  isSaving: boolean
  opened: boolean
  organization?: ClientResourceOrganization
  storages: ClientResourceStorage[]
  taxInspections: ClientResourceTaxInspection[]
  title: string
  vatRates: ClientResourceVatRate[]
  onClose: () => void
  onSave: (values: OrganizationFormValues) => void
}) {
  const [values, setValues] = useValueState<OrganizationFormValues>(() =>
    organizationToFormValues(organization),
  )
  const alternativeTranslation = getAlternativeTranslation(organization)

  function setField<K extends keyof OrganizationFormValues>(key: K, value: OrganizationFormValues[K]) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  return (
    <AppModal centered opened={opened} size="xl" title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(values)
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} stroke={1.8} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              autoFocus
              label={translate("Назва")}
              required
              value={values.Name}
              onChange={(event) => setField('Name', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Повна назва")}
              value={values.FullName}
              onChange={(event) => setField('FullName', event.currentTarget.value)}
            />
            {alternativeTranslation ? (
              <TextInput
                label={translate("Додаткова назва")}
                value={values.TranslationName}
                onChange={(event) => setField('TranslationName', event.currentTarget.value)}
              />
            ) : null}
            <Select
              allowDeselect={false}
              data={[{ value: UKRAINE_CULTURE, label: translate('Україна') }]}
              disabled
              label={translate("Країна")}
              value={UKRAINE_CULTURE}
            />
            <Select
              clearable
              data={toEntityOptions(currencies, (currency) => currency.Code ? `${currency.Code} · ${displayValue(currency.Name)}` : displayValue(currency.Name))}
              label={translate("Валюта")}
              placeholder={translate("Оберіть валюту")}
              value={values.CurrencyId}
              onChange={(value) => setField('CurrencyId', value || '')}
            />
            <Select
              clearable
              data={toEntityOptions(storages, (storage) => displayValue(storage.Name))}
              label={translate("Склад")}
              placeholder={translate("Оберіть склад")}
              value={values.StorageId}
              onChange={(value) => setField('StorageId', value || '')}
            />
            <Select
              clearable
              data={toEntityOptions(taxInspections, (inspection) => displayValue(inspection.InspectionName))}
              label={translate("Податкова")}
              placeholder={translate("Оберіть податкову")}
              value={values.TaxInspectionId}
              onChange={(value) => setField('TaxInspectionId', value || '')}
            />
            <Select
              allowDeselect={false}
              data={TYPE_TAXATION_OPTIONS.map((option) => ({
                ...option,
                label: translate(option.label),
              }))}
              label={translate("Система оподаткування")}
              value={values.TypeTaxation}
              onChange={(value) => setField('TypeTaxation', value || '0')}
            />
            <Select
              clearable
              data={toEntityOptions(vatRates, (vatRate) => formatVatRate(vatRate))}
              label={translate("Ставка ПДВ")}
              placeholder={translate("Без ставки")}
              value={values.VatRateId}
              onChange={(value) => setField('VatRateId', value || '')}
            />
            {organization?.Id && organization.PaymentRegisters?.length ? (
              <Select
                allowDeselect={false}
                data={toEntityOptions(organization.PaymentRegisters, (register) => displayValue(register.Name))}
                label={translate("Основний банківський рахунок")}
                placeholder={translate("Оберіть рахунок")}
                value={values.MainPaymentRegisterId}
                onChange={(value) =>
                  setField(
                    'MainPaymentRegisterId',
                    value || toOptionalEntityId(organization?.PaymentRegisters?.[0]?.Id),
                  )}
              />
            ) : null}
            <TextInput
              label={translate("Код")}
              value={values.Code}
              onChange={(event) => setField('Code', event.currentTarget.value)}
            />
            <TextInput
              label={translate("ІПН")}
              value={values.TIN}
              onChange={(event) => setField('TIN', event.currentTarget.value)}
            />
            <TextInput
              label={translate("ЄДРПОУ")}
              value={values.USREOU}
              onChange={(event) => setField('USREOU', event.currentTarget.value)}
            />
            <TextInput
              label={translate("КВЕД")}
              value={values.SROI}
              onChange={(event) => setField('SROI', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Реєстраційний номер")}
              value={values.RegistrationNumber}
              onChange={(event) => setField('RegistrationNumber', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Дата реєстрації")}
              type="date"
              value={values.RegistrationDate}
              onChange={(event) => setField('RegistrationDate', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Номер ПФУ")}
              value={values.PFURegistrationNumber}
              onChange={(event) => setField('PFURegistrationNumber', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Дата ПФУ")}
              type="date"
              value={values.PFURegistrationDate}
              onChange={(event) => setField('PFURegistrationDate', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Телефон")}
              value={values.PhoneNumber}
              onChange={(event) => setField('PhoneNumber', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Директор")}
              value={values.Manager}
              onChange={(event) => setField('Manager', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Адреса")}
              value={values.Address}
              onChange={(event) => setField('Address', event.currentTarget.value)}
            />
          </SimpleGrid>
          <Group gap="xl">
            <Checkbox
              checked={values.IsIndividual}
              label={translate("Фізична особа")}
              onChange={(event) => setField('IsIndividual', event.currentTarget.checked)}
            />
            <Checkbox
              checked={values.IsVatAgreements}
              label={translate("ПДВ договори")}
              onChange={(event) => setField('IsVatAgreements', event.currentTarget.checked)}
            />
          </Group>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              Скасувати
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              Зберегти
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function TaxInspectionsPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceTaxInspection[]>(getClientResourceTaxInspections, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<TaxInspectionEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-tax-inspections', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((inspection) =>
        matchesSearch(search, [
          inspection.InspectionName,
          inspection.InspectionNumber,
          inspection.InspectionRegionCode,
          inspection.InspectionRegionName,
          inspection.InspectionType,
          inspection.InspectionUSREOU,
          inspection.InspectionAddress,
        ]),
      ),
    [search, state.data],
  )

  function openCreateTaxInspection() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditTaxInspection(taxInspection: ClientResourceTaxInspection) {
    setFormError(null)
    setEditor({ mode: 'edit', taxInspection })
  }

  async function saveTaxInspection(values: TaxInspectionFormValues) {
    setSaving(true)
    setFormError(null)

    try {
      const payload = buildTaxInspectionPayload(editor?.taxInspection, values)

      if (editor?.mode === 'edit') {
        await updateClientResourceTaxInspection(payload)
      } else {
        await createClientResourceTaxInspection(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Податкову інспекцію оновлено') : translate('Податкову інспекцію створено'),
      })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти налогову інспекцію'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTaxInspection() {
    if (deleteTarget?.type !== 'taxInspection') {
      return
    }

    const netId = deleteTarget.taxInspection.NetUid

    if (!netId) {
      setFormError(translate('Податкова інспекція не має ідентифікатора'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceTaxInspection(netId)
      notifications.show({ color: 'green', message: translate('Податкову інспекцію видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити налогову інспекцію'))
    } finally {
      setSaving(false)
    }
  }
  const taxInspectionHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={TAX_INSPECTION_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateTaxInspection}>
          Нова налогова інспекція
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={taxInspectionHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      <Loadable state={state} emptyTitle="Налогових інспекцій не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'name',
                header: 'Назва',
                accessor: (inspection) => inspection.InspectionName,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionName} />,
                maxWidth: 210,
                width: 210,
              },
              {
                id: 'number',
                header: 'Код ГНИ',
                accessor: (inspection) => inspection.InspectionNumber,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionNumber} />,
                maxWidth: 110,
                width: 110,
              },
              {
                id: 'regionCode',
                header: 'Код адм.района',
                accessor: (inspection) => inspection.InspectionRegionCode,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionRegionCode} />,
                maxWidth: 130,
                width: 130,
              },
              {
                id: 'region',
                header: 'Назва адм.района',
                accessor: (inspection) => inspection.InspectionRegionName,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionRegionName} />,
                maxWidth: 180,
                width: 180,
              },
              {
                id: 'type',
                header: 'Тип ГНИ',
                accessor: (inspection) => inspection.InspectionType,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionType} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'usreou',
                header: 'Код по ЄДРПОУ',
                accessor: (inspection) => inspection.InspectionUSREOU,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionUSREOU} />,
                maxWidth: 130,
                width: 130,
              },
              {
                id: 'address',
                header: 'Адреса',
                accessor: (inspection) => inspection.InspectionAddress,
                cell: (inspection) => <TruncatedCell value={inspection.InspectionAddress} />,
                maxWidth: 180,
                width: 180,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (inspection) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={TAX_INSPECTION_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати налогову інспекцію")}
                          color="gray"
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditTaxInspection(inspection)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permissionKey={TAX_INSPECTION_DELETE_PERMISSION}>
                      <Tooltip label={translate("Видалити")}>
                        <ActionIcon
                          aria-label={translate("Видалити налогову інспекцію")}
                          color="red"
                          disabled={!inspection.NetUid}
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setFormError(null)
                            setDeleteTarget({ type: 'taxInspection', taxInspection: inspection })
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                  </Group>
                ),
              },
            ]}
            data={filtered}
            density={density}
            emptyText={translate("За цим пошуком немає інспекцій")}
            layoutVersion="client-resources-tax-inspections-table-2"
            minWidth={1052}
            tableId="tax-inspections"
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає інспекцій")} />
        )}
      </Loadable>
      <TaxInspectionEditorModal
        key={editor ? `tax-inspection-${editor.mode}-${getEntityKey(editor.taxInspection)}` : 'tax-inspection-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        taxInspection={editor?.taxInspection}
        title={editor?.mode === 'edit' ? translate('Редагувати налогову інспекцію') : translate('Нова налогова інспекція')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveTaxInspection}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'taxInspection'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteTaxInspection}
      />
    </ResourcePanel>
  )
}

function PricingPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourcePricing[]>(getClientResourcePricings, [])
  const currenciesState = useResourceData<ClientResourceCurrency[]>(getClientResourceCurrencies, [])
  const priceTypesState = useResourceData<ClientResourcePricingType[]>(getClientResourcePricingTypes, [])
  const basePricingsState = useResourceData<ClientResourcePricing[]>(getClientResourceBasePricings, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<PricingEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-pricing', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((pricing) =>
        matchesSearch(search, [
          pricing.Name,
          pricing.Comment,
          pricing.Currency?.Name,
          pricing.PriceType?.Name,
          ...getTranslationNames(pricing.PricingTranslations),
        ]),
      ),
    [search, state.data],
  )
  const supportError = currenciesState.error || priceTypesState.error || basePricingsState.error
  const isLoadingSupport = currenciesState.isLoading || priceTypesState.isLoading || basePricingsState.isLoading
  const isPricingSupportBlocked = Boolean(supportError) || currenciesState.data.length === 0 || priceTypesState.data.length === 0

  function openCreatePricing() {
    if (isPricingSupportBlocked) {
      setFormError(supportError || translate('Довідники цін ще не завантажені'))
      return
    }

    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditPricing(pricing: ClientResourcePricing) {
    setFormError(null)
    setEditor({ mode: 'edit', pricing })
  }

  function requestDeletePricing(pricing: ClientResourcePricing) {
    setFormError(null)
    setDeleteTarget({ type: 'pricing', pricing })
  }

  async function savePricing(values: PricingFormValues) {
    if (isPricingSupportBlocked) {
      setFormError(supportError || translate('Довідники цін ще не завантажені'))
      return
    }

    if (!findEntityById(currenciesState.data, values.CurrencyId)) {
      setFormError(translate('Оберіть валюту'))
      return
    }

    if (!findEntityById(priceTypesState.data, values.PriceTypeId)) {
      setFormError(translate('Оберіть тип ціни'))
      return
    }

    const validationError = validatePricingForm(values, priceTypesState.data, editor?.pricing)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildPricingPayload(editor?.pricing, values, {
        basePricings: basePricingsState.data,
        currencies: currenciesState.data,
        priceTypes: priceTypesState.data,
      })

      if (editor?.mode === 'edit') {
        await updateClientResourcePricing(payload)
      } else {
        await createClientResourcePricing(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Правило оновлено') : translate('Правило створено'),
      })
      setEditor(null)
      state.reload()
      basePricingsState.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти правило'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePricing() {
    if (deleteTarget?.type !== 'pricing') {
      return
    }

    const netId = deleteTarget.pricing.NetUid

    if (!netId) {
      setFormError(translate('Правило не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourcePricing(netId)
      notifications.show({ color: 'green', message: translate('Правило видалено') })
      setDeleteTarget(null)
      state.reload()
      basePricingsState.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити правило'))
    } finally {
      setSaving(false)
    }
  }

  async function changePricingPriority(pricing: ClientResourcePricing, raise: boolean) {
    if (!pricing.Id) {
      return
    }

    setSaving(true)

    try {
      await changeClientResourcePricingPriority(pricing.Id, raise)
      state.reload()
    } catch (priorityError) {
      notifications.show({
        color: 'red',
        message: priorityError instanceof Error ? priorityError.message : translate('Не вдалося змінити пріоритет'),
      })
    } finally {
      setSaving(false)
    }
  }
  const pricingHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={PRICING_CREATE_PERMISSION}>
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isPricingSupportBlocked}
          leftSection={<IconPlus size={16} />}
          loading={isLoadingSupport}
          size="xs"
          onClick={openCreatePricing}
        >
          Нове правило
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={pricingHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      {supportError ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} stroke={1.8} />} mb="md" variant="light">
          {supportError}
        </Alert>
      ) : null}
      <Loadable state={state} emptyTitle="Цінових правил не знайдено">
        {filtered.length ? (
          <PricingResourceTable
            density={density}
            isSaving={isSaving}
            pricings={filtered}
            onChangePriority={changePricingPriority}
            onDelete={requestDeletePricing}
            onEdit={openEditPricing}
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає правил")} />
        )}
      </Loadable>
      <PricingEditorModal
        key={editor ? `pricing-${editor.mode}-${getEntityKey(editor.pricing)}` : 'pricing-closed'}
        basePricings={basePricingsState.data}
        currencies={currenciesState.data}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        priceTypes={priceTypesState.data}
        pricing={editor?.pricing}
        title={editor?.mode === 'edit' ? translate('Редагувати правило') : translate('Нове правило')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={savePricing}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'pricing'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeletePricing}
      />
    </ResourcePanel>
  )
}

type PricingResourceTableProps = {
  density?: DataTableDensity
  isSaving: boolean
  pricings: ClientResourcePricing[]
  onChangePriority: (pricing: ClientResourcePricing, raise: boolean) => void
  onDelete: (pricing: ClientResourcePricing) => void
  onEdit: (pricing: ClientResourcePricing) => void
}

function PricingResourceTable({
  density,
  isSaving,
  pricings,
  onChangePriority,
  onDelete,
  onEdit,
}: PricingResourceTableProps) {
  const columns = useMemo<DataTableColumn<ClientResourcePricing>[]>(
    () => [
      {
        id: 'priority',
        header: 'Пріоритет',
        accessor: (pricing) => pricing.SortingPriority,
        maxWidth: 120,
        width: 120,
        cell: (pricing) => (
          <Group gap={4} wrap="nowrap">
            <Text size="sm">{displayValue(pricing.SortingPriority)}</Text>
            <PermissionGate permissionKey={PRICING_PRIORITY_PERMISSION}>
              <Group gap={2} wrap="nowrap">
                <Tooltip label={translate("Підняти")}>
                  <ActionIcon
                    aria-label={translate("Підняти пріоритет")}
                    color="gray"
                    disabled={!pricing.Id || isSaving}
                    size="xs"
                    variant="subtle"
                    onClick={() => onChangePriority(pricing, true)}
                  >
                    <IconArrowUp size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={translate("Опустити")}>
                  <ActionIcon
                    aria-label={translate("Опустити пріоритет")}
                    color="gray"
                    disabled={!pricing.Id || isSaving}
                    size="xs"
                    variant="subtle"
                    onClick={() => onChangePriority(pricing, false)}
                  >
                    <IconArrowDown size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </PermissionGate>
          </Group>
        ),
      },
      {
        id: 'name',
        header: 'Назва',
        accessor: (pricing) => displayTranslatedEntity(pricing.Name, pricing.PricingTranslations),
        cell: (pricing) => (
          <TruncatedCell value={displayTranslatedEntity(pricing.Name, pricing.PricingTranslations)} />
        ),
        maxWidth: 210,
        width: 210,
      },
      {
        id: 'markup',
        header: 'Націнка',
        accessor: (pricing) => pricing.ExtraCharge,
        cell: (pricing) => formatPercent(pricing.ExtraCharge),
        maxWidth: 100,
        width: 100,
      },
      {
        id: 'currency',
        header: 'Валюта',
        accessor: (pricing) => displayCurrency(pricing.Currency),
        cell: (pricing) => <TruncatedCell value={displayCurrency(pricing.Currency)} />,
        maxWidth: 120,
        width: 120,
      },
      {
        id: 'priceType',
        header: 'Тип ціни',
        accessor: (pricing) => pricing.PriceType?.Name,
        cell: (pricing) => <TruncatedCell value={pricing.PriceType?.Name} />,
        maxWidth: 150,
        width: 150,
      },
      {
        id: 'base',
        header: 'База',
        accessor: (pricing) => displayTranslatedEntity(pricing.BasePricing?.Name, pricing.BasePricing?.PricingTranslations),
        cell: (pricing) => (
          <TruncatedCell value={displayTranslatedEntity(pricing.BasePricing?.Name, pricing.BasePricing?.PricingTranslations)} />
        ),
        maxWidth: 170,
        width: 170,
      },
      {
        id: 'vat',
        header: 'ПДВ',
        accessor: (pricing) => pricing.ForVat,
        cell: (pricing) => <BooleanBadge value={pricing.ForVat} />,
        maxWidth: 80,
        width: 80,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        width: 72,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (pricing) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <PermissionGate permissionKey={PRICING_EDIT_PERMISSION}>
              <Tooltip label={translate("Редагувати")}>
                <ActionIcon
                  aria-label={translate("Редагувати правило")}
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={() => onEdit(pricing)}
                >
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
            <PermissionGate permissionKey={PRICING_DELETE_PERMISSION}>
              <Tooltip label={translate("Видалити")}>
                <ActionIcon
                  aria-label={translate("Видалити правило")}
                  color="red"
                  disabled={!pricing.NetUid}
                  size="sm"
                  variant="subtle"
                  onClick={() => onDelete(pricing)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
        ),
      },
    ],
    [isSaving, onChangePriority, onDelete, onEdit],
  )

  return (
    <ResourceDataTable
      columns={columns}
      data={pricings}
      density={density}
      emptyText={translate("За цим пошуком немає правил")}
      layoutVersion="client-resources-pricing-table-2"
      minWidth={1022}
      tableId="pricing"
    />
  )
}

function CurrenciesPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceCurrency[]>(getClientResourceCurrencies, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<CurrencyEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-currencies', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((currency) =>
        matchesSearch(search, [currency.Name, currency.Code, ...getTranslationNames(currency.CurrencyTranslations)]),
      ),
    [search, state.data],
  )

  function openCreateCurrency() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditCurrency(currency: ClientResourceCurrency) {
    setFormError(null)
    setEditor({ mode: 'edit', currency })
  }

  async function saveCurrency(values: CurrencyFormValues) {
    const validationError = validateCurrencyForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildCurrencyPayload(editor?.currency, values)

      if (editor?.mode === 'edit') {
        await updateClientResourceCurrency(payload)
      } else {
        await createClientResourceCurrency(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Валюту оновлено') : translate('Валюту створено'),
      })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти валюту'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteCurrency() {
    if (deleteTarget?.type !== 'currency') {
      return
    }

    const netId = deleteTarget.currency.NetUid

    if (!netId) {
      setFormError(translate('Валюта не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceCurrency(netId)
      notifications.show({ color: 'green', message: translate('Валюту видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити валюту'))
    } finally {
      setSaving(false)
    }
  }
  const currencyHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={CURRENCY_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateCurrency}>
          Нова валюта
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={currencyHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      <Loadable state={state} emptyTitle="Валют не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'code',
                header: 'Код',
                accessor: (currency) => currency.Code,
                cell: (currency) => <TruncatedCell value={currency.Code} />,
                maxWidth: 90,
                width: 90,
              },
              {
                id: 'name',
                header: 'Назва',
                accessor: (currency) => currency.Name,
                cell: (currency) => <TruncatedCell value={currency.Name} />,
                maxWidth: 190,
                width: 190,
              },
              {
                id: 'translations',
                header: 'Переклади',
                accessor: (currency) => (currency.CurrencyTranslations || []).map((translation) => translation.CultureCode).join(', '),
                cell: (currency) => displayTranslationBadges(currency.CurrencyTranslations),
                maxWidth: 180,
                width: 180,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (currency) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={CURRENCY_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати валюту")}
                          color="gray"
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditCurrency(currency)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permissionKey={CURRENCY_DELETE_PERMISSION}>
                      <Tooltip label={translate("Видалити")}>
                        <ActionIcon
                          aria-label={translate("Видалити валюту")}
                          color="red"
                          disabled={!currency.NetUid}
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setFormError(null)
                            setDeleteTarget({ type: 'currency', currency })
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                  </Group>
                ),
              },
            ]}
            data={filtered}
            density={density}
            emptyText={translate("За цим пошуком немає валют")}
            layoutVersion="client-resources-currencies-table-2"
            minWidth={532}
            tableId="currencies"
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає валют")} />
        )}
      </Loadable>
      <CurrencyEditorModal
        key={editor ? `currency-${editor.mode}-${getEntityKey(editor.currency)}` : 'currency-closed'}
        currency={editor?.currency}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        title={editor?.mode === 'edit' ? translate('Редагувати валюту') : translate('Нова валюта')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveCurrency}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'currency'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteCurrency}
      />
    </ResourcePanel>
  )
}

function StoragesPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceStorage[]>(getClientResourceStorages, [])
  const organizationsState = useResourceData<ClientResourceOrganization[]>(getClientResourceOrganizations, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<StorageEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-storages', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((storage) =>
        matchesSearch(search, [
          storage.Name,
          storage.Organization?.Name,
          storage.Organization?.FullName,
          storage.Locale,
          storage.NetUid,
        ]),
      ),
    [search, state.data],
  )

  function openCreateStorage() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditStorage(storage: ClientResourceStorage) {
    setFormError(null)
    setEditor({ mode: 'edit', storage })
  }

  async function saveStorage(values: StorageFormValues) {
    const validationError = validateStorageForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildStoragePayload(editor?.storage, values, organizationsState.data)

      if (editor?.mode === 'edit') {
        await updateClientResourceStorage(payload)
      } else {
        await createClientResourceStorage(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Склад оновлено') : translate('Склад створено'),
      })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти склад'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteStorage() {
    if (deleteTarget?.type !== 'storage') {
      return
    }

    const netId = deleteTarget.storage.NetUid

    if (!netId) {
      setFormError(translate('Склад не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceStorage(netId)
      notifications.show({ color: 'green', message: translate('Склад видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити склад'))
    } finally {
      setSaving(false)
    }
  }
  const storageHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={STORAGE_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateStorage}>
          Новий склад
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={storageHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      {organizationsState.error ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} stroke={1.8} />} mb="md" variant="light">
          {organizationsState.error}
        </Alert>
      ) : null}
      <Loadable state={state} emptyTitle="Складів не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'storage',
                header: 'Склад',
                accessor: (storage) => storage.Name,
                cell: (storage) => <TruncatedCell value={storage.Name} />,
                maxWidth: 220,
                width: 220,
              },
              {
                id: 'organization',
                header: 'Організація',
                accessor: (storage) => storage.Organization?.Name,
                cell: (storage) => <TruncatedCell value={storage.Organization?.Name} />,
                maxWidth: 190,
                width: 190,
              },
              {
                id: 'priority',
                header: 'Пріоритет',
                accessor: (storage) => storage.RetailPriority,
                maxWidth: 100,
                width: 100,
              },
              {
                id: 'defective',
                header: 'Брак',
                accessor: (storage) => storage.ForDefective,
                cell: (storage) => <BooleanBadge value={storage.ForDefective} />,
                maxWidth: 80,
                width: 80,
              },
              {
                id: 'vat',
                header: 'ПДВ',
                accessor: (storage) => storage.ForVatProducts,
                cell: (storage) => <BooleanBadge value={storage.ForVatProducts} />,
                maxWidth: 80,
                width: 80,
              },
              {
                id: 'ecommerce',
                header: 'Інтернет-магазин',
                accessor: (storage) => storage.ForEcommerce,
                cell: (storage) => <BooleanBadge value={storage.ForEcommerce} />,
                maxWidth: 140,
                width: 140,
              },
              {
                id: 'resale',
                header: 'Перепродаж',
                accessor: (storage) => storage.IsResale || storage.AvailableForReSale,
                cell: (storage) => <BooleanBadge value={storage.IsResale || storage.AvailableForReSale} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (storage) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={STORAGE_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати склад")}
                          color="gray"
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditStorage(storage)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permissionKey={STORAGE_DELETE_PERMISSION}>
                      <Tooltip label={translate("Видалити")}>
                        <ActionIcon
                          aria-label={translate("Видалити склад")}
                          color="red"
                          disabled={!storage.NetUid}
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setFormError(null)
                            setDeleteTarget({ type: 'storage', storage })
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                  </Group>
                ),
              },
            ]}
            data={filtered}
            density={density}
            emptyText={translate("За цим пошуком немає складів")}
            layoutVersion="client-resources-storages-table-2"
            minWidth={1002}
            tableId="storages"
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає складів")} />
        )}
      </Loadable>
      <StorageEditorModal
        key={editor ? `storage-${editor.mode}-${getEntityKey(editor.storage)}` : 'storage-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        organizations={organizationsState.data}
        storage={editor?.storage}
        title={editor?.mode === 'edit' ? translate('Редагувати склад') : translate('Новий склад')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveStorage}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'storage'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteStorage}
      />
    </ResourcePanel>
  )
}

function MeasureUnitsPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceMeasureUnit[]>(getClientResourceMeasureUnits, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<MeasureUnitEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-measure-units', 'compact')
  const filtered = useMemo(
    () =>
      state.data.filter((measureUnit) =>
        matchesSearch(search, [measureUnit.CodeOneC, measureUnit.Name, measureUnit.Description, measureUnit.NetUid]),
      ),
    [search, state.data],
  )

  function openCreateMeasureUnit() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditMeasureUnit(measureUnit: ClientResourceMeasureUnit) {
    setFormError(null)
    setEditor({ mode: 'edit', measureUnit })
  }

  async function saveMeasureUnit(values: MeasureUnitFormValues) {
    const validationError = validateMeasureUnitForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildMeasureUnitPayload(editor?.measureUnit, values)

      if (editor?.mode === 'edit') {
        await updateClientResourceMeasureUnit(payload)
      } else {
        await createClientResourceMeasureUnit(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Одиницю оновлено') : translate('Одиницю створено'),
      })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти одиницю'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteMeasureUnit() {
    if (deleteTarget?.type !== 'measureUnit') {
      return
    }

    const netId = deleteTarget.measureUnit.NetUid

    if (!netId) {
      setFormError(translate('Одиниця не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceMeasureUnit(netId)
      notifications.show({ color: 'green', message: translate('Одиницю видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити одиницю'))
    } finally {
      setSaving(false)
    }
  }
  const measureUnitHeaderAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
      <PermissionGate permissionKey={MEASURE_UNIT_CREATE_PERMISSION}>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateMeasureUnit}>
          Нова одиниця
        </Button>
      </PermissionGate>
      <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
    </Group>
  )

  return (
    <ResourcePanel action={measureUnitHeaderAction} section={section}>
      <PanelToolbar
        isLoading={state.isLoading}
        onSearchChange={setSearch}
        searchFullWidth
        searchValue={search}
      />
      <Loadable state={state} emptyTitle="Одиниць виміру не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'codeOneC',
                header: 'Код 1С',
                accessor: (measureUnit) => measureUnit.CodeOneC,
                cell: (measureUnit) => <TruncatedCell value={measureUnit.CodeOneC} />,
                maxWidth: 120,
                width: 120,
              },
              {
                id: 'name',
                header: 'Назва',
                accessor: (measureUnit) => measureUnit.Name,
                cell: (measureUnit) => <TruncatedCell value={measureUnit.Name} />,
                maxWidth: 180,
                width: 180,
              },
              {
                id: 'description',
                header: 'Повна назва',
                accessor: (measureUnit) => measureUnit.Description,
                cell: (measureUnit) => <TruncatedCell value={measureUnit.Description} />,
                maxWidth: 220,
                width: 220,
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (measureUnit) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={MEASURE_UNIT_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати одиницю")}
                          color="gray"
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditMeasureUnit(measureUnit)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permissionKey={MEASURE_UNIT_DELETE_PERMISSION}>
                      <Tooltip label={translate("Видалити")}>
                        <ActionIcon
                          aria-label={translate("Видалити одиницю")}
                          color="red"
                          disabled={!measureUnit.NetUid}
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            setFormError(null)
                            setDeleteTarget({ type: 'measureUnit', measureUnit })
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </PermissionGate>
                  </Group>
                ),
              },
            ]}
            data={filtered}
            density={density}
            emptyText={translate("За цим пошуком немає одиниць")}
            layoutVersion="client-resources-measure-units-table-2"
            minWidth={592}
            tableId="measure-units"
          />
        ) : (
          <EmptyState title={translate("За цим пошуком немає одиниць")} />
        )}
      </Loadable>
      <MeasureUnitEditorModal
        key={editor ? `measure-unit-${editor.mode}-${getEntityKey(editor.measureUnit)}` : 'measure-unit-closed'}
        error={formError}
        isSaving={isSaving}
        measureUnit={editor?.measureUnit}
        opened={Boolean(editor)}
        title={editor?.mode === 'edit' ? translate('Редагувати одиницю') : translate('Нова одиниця')}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveMeasureUnit}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'measureUnit'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteMeasureUnit}
      />
    </ResourcePanel>
  )
}

function ProductReservePanel({ section }: { section: ClientResourceSection }) {
  const navigate = useNavigate()
  const state = useResourceData<ClientResourceClientType[]>(getClientResourceClientTypes, [])
  const [editor, setEditor] = useValueState<ReserveEditorState | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('client-resources-product-reserve', 'compact')
  const roles = useMemo(() => getBuyerRoles(state.data), [state.data])

  async function saveReserveDays(daysValue: string) {
    if (!editor?.role) {
      return
    }

    const days = Number(daysValue)

    if (!Number.isInteger(days) || days < 0) {
      setFormError(translate('Вкажіть коректну кількість днів'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await updateClientResourceClientTypeRole({
        ...editor.role,
        OrderExpireDays: days,
      })
      notifications.show({ color: 'green', message: translate('Резерв оновлено') })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося оновити резерв'))
    } finally {
      setSaving(false)
    }
  }

  function openClientsForRole(role: ClientResourceClientTypeRole) {
    if (role.Id) {
      navigate(`/clients?roleIds=${role.Id}`)
    }
  }

  return (
    <ResourcePanel
      action={
        <Group gap="xs" wrap="nowrap">
          <RefreshControl isLoading={state.isLoading} onRefresh={state.reload} />
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
        </Group>
      }
      section={section}
    >
      <Loadable state={state} emptyTitle="Ролей клієнтів не знайдено">
        {roles.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'role',
                header: 'Роль',
                accessor: (role) => role.Name,
                maxWidth: 220,
                width: 220,
                cell: (role) => (
                  <Tooltip
                    classNames={{ tooltip: 'client-resources-cell-tooltip' }}
                    disabled={!role.Name}
                    label={displayValue(role.Name)}
                    maw={420}
                    multiline
                    openDelay={350}
                    position="top-start"
                    withArrow
                  >
                    <Button
                      className="client-resources-truncated-action"
                      color={CREATE_ACTION_COLOR}
                      disabled={!role.Id}
                      rightSection={<IconExternalLink size={14} />}
                      size="xs"
                      variant="subtle"
                      onClick={() => openClientsForRole(role)}
                    >
                      {displayValue(role.Name)}
                    </Button>
                  </Tooltip>
                ),
              },
              {
                id: 'description',
                header: 'Опис',
                accessor: (role) => role.Description,
                cell: (role) => <TruncatedCell value={role.Description} />,
                maxWidth: 260,
                width: 260,
              },
              {
                id: 'reserveDays',
                header: 'Днів резерву',
                accessor: (role) => role.OrderExpireDays,
                maxWidth: 120,
                width: 120,
                cell: (role) => (
                  <Badge color={CREATE_ACTION_COLOR} variant="light">
                    {displayValue(role.OrderExpireDays)}
                  </Badge>
                ),
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: 72,
                enableHiding: false,
                enableReorder: false,
                enableResizing: false,
                enableSorting: false,
                cell: (role) => (
                  <Group justify="flex-end" wrap="nowrap">
                    <Tooltip label={translate("Редагувати")}>
                      <ActionIcon
                        aria-label={translate("Редагувати резерв")}
                        color="gray"
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          setFormError(null)
                          setEditor({ role })
                        }}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ),
              },
            ]}
            data={roles}
            density={density}
            emptyText={translate("Ролей покупців не знайдено")}
            layoutVersion="client-resources-product-reserve-table-2"
            minWidth={672}
            tableId="product-reserve"
          />
        ) : (
          <EmptyState title={translate("Ролей покупців не знайдено")} />
        )}
      </Loadable>
      <ReserveEditorModal
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        role={editor?.role}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveReserveDays}
      />
    </ResourcePanel>
  )
}

function CarrierPanel({ section }: { section: ClientResourceSection }) {
  const typesState = useResourceData<ClientResourceTransporterType[]>(getClientResourceTransporterTypes, [])
  const [typeNetId, setTypeNetId] = useValueState<string | null>(null)
  const [editor, setEditor] = useValueState<TransporterEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const ukraineTransporterTypes = useMemo(
    () => typesState.data.filter(isUkraineTransporterType),
    [typesState.data],
  )
  const typeOptions = useMemo(
    () =>
      ukraineTransporterTypes.reduce<Array<{ label: string; value: string }>>((options, type) => {
        if (type.NetUid) {
          options.push({ value: String(type.NetUid), label: displayValue(type.Name) })
        }

        return options
      }, []),
    [ukraineTransporterTypes],
  )
  const selectedUkraineTypeNetId = ukraineTransporterTypes.some((type) => type.NetUid === typeNetId)
    ? typeNetId
    : null
  const effectiveTypeNetId = selectedUkraineTypeNetId || pickDefaultTransporterType(ukraineTransporterTypes)?.NetUid || null
  const loadTransporters = useCallback(() => {
    if (!effectiveTypeNetId) {
      return Promise.resolve([] as ClientResourceTransporter[])
    }

    return getClientResourceTransporters(effectiveTypeNetId)
  }, [effectiveTypeNetId])
  const transportersState = useResourceData<ClientResourceTransporter[]>(loadTransporters, [])
  const activeTransporters = transportersState.data.filter((transporter) => !transporter.Deleted)
  const archivedTransporters = transportersState.data.filter((transporter) => transporter.Deleted)
  const selectedTransporterType = useMemo(
    () => ukraineTransporterTypes.find((type) => type.NetUid === effectiveTypeNetId),
    [effectiveTypeNetId, ukraineTransporterTypes],
  )

  function openCreateTransporter() {
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  function openEditTransporter(transporter: ClientResourceTransporter) {
    setFormError(null)
    setEditor({ mode: 'edit', transporter })
  }

  async function saveTransporter(values: TransporterFormValues) {
    const validationError = validateTransporterForm(values)

    if (validationError) {
      setFormError(validationError)
      return
    }

    if (!selectedTransporterType?.Id) {
      setFormError(translate('Оберіть тип перевізника'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = buildTransporterPayload(editor?.transporter, values, selectedTransporterType)

      if (editor?.mode === 'edit') {
        await updateClientResourceTransporter(payload)
      } else {
        await createClientResourceTransporter(payload)
      }

      notifications.show({
        color: 'green',
        message: editor?.mode === 'edit' ? translate('Перевізника оновлено') : translate('Перевізника створено'),
      })
      setEditor(null)
      transportersState.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти перевізника'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTransporter() {
    if (deleteTarget?.type !== 'transporter') {
      return
    }

    if (isProtectedTransporter(deleteTarget.transporter)) {
      setFormError(translate('Системного перевізника не можна архівувати'))
      return
    }

    const netId = deleteTarget.transporter.NetUid

    if (!netId) {
      setFormError(translate('Перевізник не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceTransporter(netId)
      notifications.show({ color: 'green', message: translate('Перевізника переміщено в архів') })
      setDeleteTarget(null)
      transportersState.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося архівувати перевізника'))
    } finally {
      setSaving(false)
    }
  }

  const carrierAction = (
    <Group gap="xs" wrap="nowrap">
      <RefreshControl
        isLoading={typesState.isLoading || transportersState.isLoading}
        onRefresh={() => {
          typesState.reload()
          transportersState.reload()
        }}
      />
      <Button
        color="violet"
        disabled={!selectedTransporterType}
        leftSection={<IconPlus size={16} />}
        size="xs"
        onClick={openCreateTransporter}
      >
        Перевізник
      </Button>
    </Group>
  )

  return (
    <ResourcePanel action={carrierAction} section={section}>
      <Group align="flex-start" mb="md">
        <Select
          data={typeOptions}
          label={translate("Тип перевізника")}
          maw={360}
          nothingFoundMessage={translate("Типів не знайдено")}
          onChange={setTypeNetId}
          placeholder={translate("Оберіть тип")}
          value={effectiveTypeNetId}
        />
      </Group>
      <Loadable state={typesState} emptyTitle="Типів перевізників не знайдено">
        <Loadable state={transportersState} emptyTitle="Перевізників не знайдено">
          <Stack gap="xl">
            <TransporterTable
              showActions
              title={translate("Активні")}
              transporters={activeTransporters}
              onDelete={(transporter) => {
                setFormError(null)
                setDeleteTarget({ type: 'transporter', transporter })
              }}
              onEdit={openEditTransporter}
            />
            <TransporterTable
              title={translate("Архівні")}
              transporters={archivedTransporters}
              onDelete={(transporter) => {
                setFormError(null)
                setDeleteTarget({ type: 'transporter', transporter })
              }}
              onEdit={openEditTransporter}
            />
          </Stack>
        </Loadable>
      </Loadable>
      <TransporterEditorModal
        key={editor ? `transporter-${editor.mode}-${getEntityKey(editor.transporter)}` : 'transporter-closed'}
        error={formError}
        isSaving={isSaving}
        opened={Boolean(editor)}
        title={editor?.mode === 'edit' ? translate('Редагувати перевізника') : translate('Новий перевізник')}
        transporter={editor?.transporter}
        onClose={() => {
          if (!isSaving) {
            setEditor(null)
            setFormError(null)
          }
        }}
        onSave={saveTransporter}
      />
      <DeleteResourceModal
        error={formError}
        isSaving={isSaving}
        opened={deleteTarget?.type === 'transporter'}
        target={deleteTarget}
        onClose={() => {
          if (!isSaving) {
            setDeleteTarget(null)
            setFormError(null)
          }
        }}
        onConfirm={confirmDeleteTransporter}
      />
    </ResourcePanel>
  )
}

function isProtectedTransporter(transporter: ClientResourceTransporter): boolean {
  return transporter.CssClass === PROTECTED_TRANSPORTER_CSS_CLASS
}

function TransporterTable({
  showActions = false,
  title,
  transporters,
  onDelete,
  onEdit,
}: {
  showActions?: boolean
  title: string
  transporters: ClientResourceTransporter[]
  onDelete: (transporter: ClientResourceTransporter) => void
  onEdit: (transporter: ClientResourceTransporter) => void
}) {
  return (
    <Box>
      <Text fw={700} mb="xs">
        {title}
      </Text>
      {transporters.length ? (
        <ResourceDataTable
          columns={[
            {
              id: 'transporter',
              header: 'Перевізник',
              accessor: (transporter) => transporter.Name,
              maxWidth: 240,
              width: 240,
              cell: (transporter) => (
                <Tooltip
                  classNames={{ tooltip: 'client-resources-cell-tooltip' }}
                  disabled={!transporter.Name}
                  label={displayValue(transporter.Name)}
                  maw={420}
                  multiline
                  openDelay={350}
                  position="top-start"
                  withArrow
                >
                  <Group gap="sm" wrap="nowrap" className="client-resources-transporter-cell">
                    <Avatar src={transporter.ImageUrl} alt={displayValue(transporter.Name)} size="sm" radius="sm" />
                    <Text fw={600} className="client-resources-truncated-cell">
                      {displayValue(transporter.Name)}
                    </Text>
                  </Group>
                </Tooltip>
              ),
            },
            {
              id: 'type',
              header: 'Тип',
              accessor: (transporter) => transporter.TransporterType?.Name,
              cell: (transporter) => <TruncatedCell value={transporter.TransporterType?.Name} />,
              maxWidth: 180,
              width: 180,
            },
            {
              id: 'priority',
              header: 'Пріоритет',
              accessor: (transporter) => transporter.Priority,
              maxWidth: 110,
              width: 110,
            },
            ...(showActions
              ? [
                  {
                    id: 'actions',
                    header: '',
                    align: 'right' as const,
                    width: 72,
                    enableHiding: false,
                    enableReorder: false,
                    enableResizing: false,
                    enableSorting: false,
                    cell: (transporter: ClientResourceTransporter) => {
                      const isProtected = isProtectedTransporter(transporter)

                      return (
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label={translate("Редагувати")}>
                            <ActionIcon
                              aria-label={translate("Редагувати перевізника")}
                              color="gray"
                              size="sm"
                              variant="subtle"
                              onClick={() => onEdit(transporter)}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={isProtected ? translate("Системного перевізника не можна архівувати") : translate("Архівувати")}>
                            <ActionIcon
                              aria-label={translate("Архівувати перевізника")}
                              color="red"
                              disabled={!transporter.NetUid || isProtected}
                              size="sm"
                              variant="subtle"
                              onClick={() => onDelete(transporter)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )
                    },
                  },
                ]
              : []),
          ]}
          data={transporters}
          emptyText={translate("Записів немає")}
          layoutVersion="client-resources-transporters-table-2"
          minWidth={showActions ? 602 : 530}
          tableId={`transporters-${title}`}
        />
      ) : (
        <EmptyState title={translate("Записів немає")} />
      )}
    </Box>
  )
}

function ResourcePanel({
  action,
  children,
}: {
  action?: ReactNode
  children: ReactNode
  section: ClientResourceSection
}) {
  return (
    <section className="client-resources-panel">
      {action ? <PageHeaderActions>{action}</PageHeaderActions> : null}
      {children}
    </section>
  )
}

function PanelToolbar({
  action,
  isLoading,
  onRefresh,
  onSearchChange,
  searchFullWidth = false,
  searchValue,
}: {
  action?: ReactNode
  isLoading: boolean
  onRefresh?: () => void
  onSearchChange?: (value: string) => void
  searchFullWidth?: boolean
  searchValue?: string
}) {
  const { t } = useI18n()

  return (
    <Group justify="space-between" align="center" mb="md" gap="sm">
      {onSearchChange ? (
        <TextInput
          className={`client-resources-search${searchFullWidth ? ' client-resources-search-full' : ''}`}
          leftSection={<IconSearch size={16} stroke={1.8} />}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={t('Пошук')}
          value={searchValue}
        />
      ) : (
        <span />
      )}
      <Group gap="xs">
        {onRefresh ? <RefreshControl isLoading={isLoading} onRefresh={onRefresh} /> : null}
        {action}
      </Group>
    </Group>
  )
}

function RefreshControl({ isLoading, onRefresh }: { isLoading: boolean; onRefresh: () => void }) {
  const { t } = useI18n()

  return (
    <Tooltip label={t('Оновити')}>
      <ActionIcon aria-label={t('Оновити')} loading={isLoading} onClick={onRefresh} variant="subtle" color="gray">
        <IconRefresh size={18} stroke={1.8} />
      </ActionIcon>
    </Tooltip>
  )
}

function Loadable<T>({
  children,
  emptyTitle,
  state,
}: {
  children: ReactNode
  emptyTitle: string
  state: ResourceLoadState<T[]>
}) {
  const { t } = useI18n()

  if (state.isLoading) {
    return (
      <Box className="client-resources-state">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {t('Завантаження')}
        </Text>
      </Box>
    )
  }

  if (state.error) {
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle size={18} stroke={1.8} />}
        title={t('Не вдалося завантажити дані')}
        variant="light"
      >
        <Group justify="space-between" gap="sm">
          <Text size="sm">{state.error}</Text>
          <Button size="xs" variant="light" color="red" onClick={state.reload}>
            {t('Повторити')}
          </Button>
        </Group>
      </Alert>
    )
  }

  if (!state.data.length) {
    return <EmptyState title={emptyTitle} />
  }

  return children
}

function EmptyState({
  icon: Icon = IconDatabaseOff,
  message,
  title,
}: {
  icon?: ResourceIcon
  message?: string
  title: string
}) {
  const { t } = useI18n()

  return (
    <Box className="client-resources-empty">
      <ThemeIcon color="gray" variant="light" radius="xl" size={44}>
        <Icon size={22} stroke={1.8} />
      </ThemeIcon>
      <div>
        <Text fw={700}>{t(title)}</Text>
        {message ? (
          <Text size="sm" c="dimmed" mt={4}>
            {t(message)}
          </Text>
        ) : null}
      </div>
    </Box>
  )
}

function normalizeTableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'table'
}

function BooleanBadge({ value }: { value?: boolean }) {
  const { t } = useI18n()

  return (
    <Badge color={value ? 'green' : 'gray'} variant="light">
      {value ? t('Так') : t('Ні')}
    </Badge>
  )
}

function useResourceData<T>(loader: () => Promise<T>, initialData: T): ResourceLoadState<T> {
  const [state, dispatch] = useReducer(resourceReducer<T>, initialData, createInitialResourceState)
  const reload = useCallback(() => dispatch({ type: 'reload' }), [])

  useEffect(() => {
    let ignore = false

    dispatch({ type: 'loadStarted' })

    loader()
      .then((result) => {
        if (!ignore) {
          dispatch({ type: 'loadSucceeded', data: result })
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          dispatch({ type: 'loadFailed', error: loadError instanceof Error ? loadError.message : translate('Невідома помилка') })
        }
      })

    return () => {
      ignore = true
    }
  }, [loader, state.revision])

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reload,
  }
}

function createInitialResourceState<T>(initialData: T): ResourceState<T> {
  return {
    data: initialData,
    error: null,
    isLoading: true,
    revision: 0,
  }
}

function resourceReducer<T>(state: ResourceState<T>, action: ResourceAction<T>): ResourceState<T> {
  switch (action.type) {
    case 'loadStarted':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'loadSucceeded':
      return {
        ...state,
        data: action.data,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      }
    case 'reload':
      return {
        ...state,
        revision: state.revision + 1,
      }
    default:
      return state
  }
}

function isClientResourceStep(value: string | undefined): value is ClientResourceStep {
  return CLIENT_RESOURCE_STEPS.includes(value as ClientResourceStep)
}

function getSection(step: ClientResourceStep): ClientResourceSection {
  return RESOURCE_SECTIONS.find((section) => section.step === step) || RESOURCE_SECTIONS[0]
}

function getBuyerRoles(clientTypes: ClientResourceClientType[]): ClientResourceClientTypeRole[] {
  return clientTypes.find((clientType) => clientType.Type === BUYER_CLIENT_TYPE)?.ClientTypeRoles || []
}

function toSelectOption(role: ClientResourceClientTypeRole) {
  return {
    value: String(role.Id),
    label: displayValue(role.Name),
  }
}

function getRoleSelectOptions(roles: ClientResourceClientTypeRole[]) {
  return roles.reduce<Array<{ label: string; value: string }>>((options, role) => {
    if (typeof role.Id === 'number' && role.Id > 0) {
      options.push(toSelectOption(role))
    }

    return options
  }, [])
}

function pickDefaultTransporterType(types: ClientResourceTransporterType[]): ClientResourceTransporterType | undefined {
  return types.find(isUkraineTransporterType)
}

function isUkraineTransporterType(type: ClientResourceTransporterType): boolean {
  const name = (type.Name || '').toLowerCase()

  return type.Id === 1 || name.includes('ua') || name.includes('ukraine') || name.includes('укр')
}

function getEntityKey(entity?: ClientResourceEntity | null, fallback?: number): string {
  return entity?.NetUid || String(entity?.Id ?? fallback ?? '')
}

function regionCodeToFormValues(regionCode?: ClientResourceRegionCode): RegionCodeFormValues {
  return {
    City: regionCode?.City || '',
    District: regionCode?.District || '',
    Value: regionCode?.Value || '',
  }
}

function validateRegionName(name: string): string | null {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return translate('Вкажіть назву регіону')
  }

  if (normalizedName.length > 5) {
    return translate('Назва регіону має бути не довша за 5 символів')
  }

  return null
}

function validateRegionCode(values: RegionCodeFormValues): string | null {
  const value = values.Value.trim()

  if (!value) {
    return translate('Вкажіть код регіону')
  }

  if (value.length > 10) {
    return translate('Код регіону має бути не довший за 10 символів')
  }

  return null
}

function getDeleteTargetMessage(target: ClientResourceDeleteTarget | null): string {
  if (!target) {
    return translate('Підтвердіть видалення запису.')
  }

  if (target.type === 'region') {
    return `${translate('Видалити регіон')} "${displayValue(target.region.Name)}"?`
  }

  if (target.type === 'regionCode') {
    return `${translate('Видалити код регіону')} "${displayValue(target.regionCode.Value)}"?`
  }

  if (target.type === 'organization') {
    return `${translate('Видалити організацію')} "${displayTranslatedEntity(target.organization.Name, target.organization.OrganizationTranslations)}"?`
  }

  if (target.type === 'taxInspection') {
    return `${translate('Видалити налогову інспекцію')} "${displayValue(target.taxInspection.InspectionName)}"?`
  }

  if (target.type === 'pricing') {
    return `${translate('Видалити правило')} "${displayTranslatedEntity(target.pricing.Name, target.pricing.PricingTranslations)}"?`
  }

  if (target.type === 'currency') {
    return `${translate('Видалити валюту')} "${displayCurrency(target.currency)}"?`
  }

  if (target.type === 'storage') {
    return `${translate('Видалити склад')} "${displayValue(target.storage.Name)}"?`
  }

  if (target.type === 'measureUnit') {
    return `${translate('Видалити одиницю')} "${displayValue(target.measureUnit.Name)}"?`
  }

  if (target.type === 'perfectClient') {
    return `${translate('Видалити параметр')} "${displayTranslatedEntity(target.perfectClient.Name, target.perfectClient.PerfectClientTranslations)}"?`
  }

  return `${translate('Архівувати перевізника')} "${displayValue(target.transporter.Name)}"?`
}

function perfectClientToFormValues(perfectClient?: ClientResourcePerfectClient): PerfectClientFormValues {
  const toggleValues = perfectClient?.Values || []

  return {
    Description: perfectClient?.Description || '',
    Lable: perfectClient?.Lable || '',
    Name: getTranslatedFormName(perfectClient?.Name, perfectClient?.PerfectClientTranslations),
    ToggleValueLeft: getPerfectClientValueFormText(toggleValues[0]),
    ToggleValueRight: getPerfectClientValueFormText(toggleValues[1]),
    Type: String(perfectClient?.Type || PERFECT_CLIENT_TOGGLE_TYPE),
    Value: perfectClient?.Value || '',
  }
}

function validatePerfectClientForm(values: PerfectClientFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву параметра')
  }

  if (Number(values.Type) === PERFECT_CLIENT_TOGGLE_TYPE) {
    if (!values.ToggleValueLeft.trim() || !values.ToggleValueRight.trim()) {
      return translate('Вкажіть обидва значення перемикача')
    }
  }

  return null
}

function buildPerfectClientPayload(
  perfectClient: ClientResourcePerfectClient | undefined,
  values: PerfectClientFormValues,
  role: ClientResourceClientTypeRole,
): ClientResourcePerfectClient {
  const name = values.Name.trim()
  const type = Number(values.Type || PERFECT_CLIENT_TOGGLE_TYPE)
  const isToggle = type === PERFECT_CLIENT_TOGGLE_TYPE

  return {
    ...(perfectClient || {}),
    ClientTypeRole: role,
    ClientTypeRoleId: role.Id,
    Description: values.Description.trim(),
    Lable: values.Lable.trim(),
    Name: name,
    PerfectClientTranslations: buildNameTranslations(perfectClient?.PerfectClientTranslations, name),
    Type: type,
    Value: isToggle ? '' : values.Value.trim(),
    Values: isToggle
      ? buildPerfectClientValues(perfectClient?.Values, values)
      : [],
  }
}

function buildPerfectClientValues(
  currentValues: ClientResourcePerfectClientValue[] | undefined,
  values: PerfectClientFormValues,
): ClientResourcePerfectClientValue[] {
  return [
    buildPerfectClientValue(currentValues?.[0], values.ToggleValueLeft.trim()),
    buildPerfectClientValue(currentValues?.[1], values.ToggleValueRight.trim()),
  ]
}

function buildPerfectClientValue(
  currentValue: ClientResourcePerfectClientValue | undefined,
  value: string,
): ClientResourcePerfectClientValue {
  return {
    ...(currentValue || {}),
    Value: value,
    PerfectClientValueTranslations: buildValueTranslations(currentValue?.PerfectClientValueTranslations, value),
  }
}

function buildValueTranslations(
  translations: ClientResourceValueTranslation[] | undefined,
  value: string,
): ClientResourceValueTranslation[] {
  const currentTranslations = translations || []
  const ukTranslation = currentTranslations.find((translation) => translation.CultureCode === UKRAINE_CULTURE)
  const otherTranslations = currentTranslations.filter(
    (translation) => Boolean(translation.CultureCode) && translation.CultureCode !== UKRAINE_CULTURE,
  )

  return [
    {
      ...(ukTranslation || {}),
      CultureCode: UKRAINE_CULTURE,
      Value: value,
    },
    ...otherTranslations,
  ]
}

function getPerfectClientValueFormText(value?: ClientResourcePerfectClientValue): string {
  return (
    value?.PerfectClientValueTranslations?.find((translation) => translation.CultureCode === UKRAINE_CULTURE)?.Value?.trim()
    || value?.Value
    || ''
  )
}

function taxInspectionToFormValues(taxInspection?: ClientResourceTaxInspection): TaxInspectionFormValues {
  return {
    InspectionAddress: taxInspection?.InspectionAddress || '',
    InspectionName: taxInspection?.InspectionName || '',
    InspectionNumber: taxInspection?.InspectionNumber || '',
    InspectionRegionCode: taxInspection?.InspectionRegionCode || '',
    InspectionRegionName: taxInspection?.InspectionRegionName || '',
    InspectionType: taxInspection?.InspectionType || '',
    InspectionUSREOU: taxInspection?.InspectionUSREOU || '',
  }
}

function buildTaxInspectionPayload(
  taxInspection: ClientResourceTaxInspection | undefined,
  values: TaxInspectionFormValues,
): ClientResourceTaxInspection {
  return {
    ...(taxInspection || {}),
    InspectionAddress: values.InspectionAddress.trim(),
    InspectionName: values.InspectionName.trim(),
    InspectionNumber: values.InspectionNumber.trim(),
    InspectionRegionCode: values.InspectionRegionCode.trim(),
    InspectionRegionName: values.InspectionRegionName.trim(),
    InspectionType: values.InspectionType.trim(),
    InspectionUSREOU: values.InspectionUSREOU.trim(),
  }
}

function pricingToFormValues(
  pricing?: ClientResourcePricing,
  defaults?: {
    basePricings: ClientResourcePricing[]
    currencies: ClientResourceCurrency[]
    priceTypes: ClientResourcePricingType[]
  },
): PricingFormValues {
  return {
    BasePricingId: toOptionalEntityId(pricing?.BasePricingId ?? pricing?.BasePricing?.Id ?? defaults?.basePricings[0]?.Id),
    Comment: pricing?.Comment || '',
    CurrencyId: toOptionalEntityId(pricing?.CurrencyId ?? pricing?.Currency?.Id ?? defaults?.currencies[0]?.Id),
    ExtraCharge: typeof pricing?.ExtraCharge === 'number' ? String(pricing.ExtraCharge) : '0',
    ForVat: pricing?.ForVat === true,
    Name: getTranslatedFormName(pricing?.Name, pricing?.PricingTranslations),
    PriceTypeId: toOptionalEntityId(pricing?.PriceTypeId ?? pricing?.PriceType?.Id ?? defaults?.priceTypes[0]?.Id),
  }
}

function validatePricingForm(
  values: PricingFormValues,
  priceTypes: ClientResourcePricingType[],
  pricing?: ClientResourcePricing,
): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву правила')
  }

  const extraCharge = Number(values.ExtraCharge || 0)
  const priceType = findEntityById(priceTypes, values.PriceTypeId)

  if (shouldShowCalculatedPriceOptions(priceType, pricing) && !values.BasePricingId) {
    return translate('Оберіть базову ціну')
  }

  if (!Number.isFinite(extraCharge)) {
    return translate('Вкажіть коректну націнку')
  }

  if (shouldShowCalculatedPriceOptions(priceType, pricing) && extraCharge === 0) {
    return translate('Вкажіть націнку для розрахункової ціни')
  }

  return null
}

function buildPricingPayload(
  pricing: ClientResourcePricing | undefined,
  values: PricingFormValues,
  resources: {
    basePricings: ClientResourcePricing[]
    currencies: ClientResourceCurrency[]
    priceTypes: ClientResourcePricingType[]
  },
): ClientResourcePricing {
  const basePricing = findEntityById(resources.basePricings, values.BasePricingId)
  const currency = findEntityById(resources.currencies, values.CurrencyId) || resources.currencies[0]
  const priceType = findEntityById(resources.priceTypes, values.PriceTypeId) || resources.priceTypes[0]
  const isCalculated = shouldShowCalculatedPriceOptions(priceType, pricing)
  const name = values.Name.trim()

  return {
    ...(pricing || {}),
    BasePricing: isCalculated ? basePricing : undefined,
    BasePricingId: isCalculated ? basePricing?.Id : undefined,
    Comment: values.Comment.trim(),
    Currency: currency,
    CurrencyId: currency?.Id,
    ExtraCharge: isCalculated ? Number(values.ExtraCharge || 0) : 0,
    ForVat: values.ForVat,
    Name: name,
    PriceType: priceType,
    PriceTypeId: priceType?.Id,
    PricingTranslations: buildNameTranslations(pricing?.PricingTranslations, name),
  }
}

function currencyToFormValues(currency?: ClientResourceCurrency): CurrencyFormValues {
  return {
    Code: currency?.Code || '',
    Name: getTranslatedFormName(currency?.Name, currency?.CurrencyTranslations),
  }
}

function validateCurrencyForm(values: CurrencyFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву валюти')
  }

  return null
}

function buildCurrencyPayload(
  currency: ClientResourceCurrency | undefined,
  values: CurrencyFormValues,
): ClientResourceCurrency {
  const name = values.Name.trim()

  return {
    ...(currency || {}),
    Code: values.Code.trim(),
    CurrencyTranslations: buildNameTranslations(currency?.CurrencyTranslations, name),
    Name: name,
  }
}

function storageToFormValues(
  storage?: ClientResourceStorage,
): StorageFormValues {
  return {
    AvailableForReSale: storage?.AvailableForReSale === true,
    ForDefective: storage?.ForDefective === true,
    ForEcommerce: storage?.ForEcommerce === true,
    ForVatProducts: storage?.ForVatProducts === true,
    IsResale: storage?.IsResale === true,
    Name: storage?.Name || '',
    OrganizationId: toOptionalEntityId(storage?.OrganizationId ?? storage?.Organization?.Id),
    RetailPriority: typeof storage?.RetailPriority === 'number' ? String(storage.RetailPriority) : '',
  }
}

function validateStorageForm(values: StorageFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву складу')
  }

  if (values.RetailPriority && !Number.isFinite(Number(values.RetailPriority))) {
    return translate('Вкажіть коректний пріоритет')
  }

  return null
}

function buildStoragePayload(
  storage: ClientResourceStorage | undefined,
  values: StorageFormValues,
  organizations: ClientResourceOrganization[],
): ClientResourceStorage {
  const organization = findEntityById(organizations, values.OrganizationId)

  return {
    ...(storage || {}),
    AvailableForReSale: values.ForVatProducts && values.AvailableForReSale,
    ForDefective: values.ForDefective,
    ForEcommerce: values.ForEcommerce,
    ForVatProducts: values.ForVatProducts,
    IsResale: values.IsResale,
    Locale: storage?.Locale || UKRAINE_CULTURE,
    Name: values.Name.trim(),
    Organization: organization,
    OrganizationId: organization?.Id,
    RetailPriority: values.RetailPriority ? Number(values.RetailPriority) : undefined,
  }
}

function measureUnitToFormValues(measureUnit?: ClientResourceMeasureUnit): MeasureUnitFormValues {
  return {
    CodeOneC: measureUnit?.CodeOneC || '',
    Description: measureUnit?.Description || '',
    Name: measureUnit?.Name || '',
  }
}

function validateMeasureUnitForm(values: MeasureUnitFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву одиниці')
  }

  if (!values.Description.trim()) {
    return translate('Вкажіть повну назву одиниці')
  }

  return null
}

function buildMeasureUnitPayload(
  measureUnit: ClientResourceMeasureUnit | undefined,
  values: MeasureUnitFormValues,
): ClientResourceMeasureUnit {
  return {
    ...(measureUnit || {}),
    CodeOneC: values.CodeOneC.trim(),
    Description: values.Description.trim(),
    Name: values.Name.trim(),
  }
}

function transporterToFormValues(transporter?: ClientResourceTransporter): TransporterFormValues {
  return {
    CssClass: transporter?.CssClass || '',
    ImageUrl: transporter?.ImageUrl || '',
    ImageFile: null,
    Name: transporter?.Name || '',
    Priority: typeof transporter?.Priority === 'number' ? String(transporter.Priority) : '',
  }
}

function validateTransporterForm(values: TransporterFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву перевізника')
  }

  if (values.Priority && !Number.isFinite(Number(values.Priority))) {
    return translate('Вкажіть коректний пріоритет')
  }

  return null
}

function buildTransporterPayload(
  transporter: ClientResourceTransporter | undefined,
  values: TransporterFormValues,
  transporterType: ClientResourceTransporterType,
): FormData {
  const nextTransporter: ClientResourceTransporter = {
    ...(transporter || {}),
    CssClass: values.CssClass.trim(),
    ImageUrl: values.ImageUrl.trim(),
    Name: values.Name.trim(),
    Priority: values.Priority ? Number(values.Priority) : undefined,
    TransporterType: transporterType,
    TransporterTypeId: transporterType.Id,
  }
  const formData = new FormData()

  formData.append('entity', JSON.stringify(nextTransporter))

  if (values.ImageFile) {
    formData.append('image', values.ImageFile)
  }

  return formData
}

function getTranslatedFormName(baseName?: string, translations?: ClientResourceTranslation[]): string {
  return getUkrainianTranslationName(translations) || baseName || ''
}

function buildNameTranslations(
  translations: ClientResourceTranslation[] | undefined,
  name: string,
): ClientResourceTranslation[] {
  const currentTranslations = translations || []
  const ukTranslation = currentTranslations.find((translation) => translation.CultureCode === UKRAINE_CULTURE)
  const otherTranslations = currentTranslations.filter(
    (translation) => Boolean(translation.CultureCode) && translation.CultureCode !== UKRAINE_CULTURE,
  )

  return [
    {
      ...(ukTranslation || {}),
      CultureCode: UKRAINE_CULTURE,
      Name: name,
    },
    ...otherTranslations,
  ]
}

function organizationToFormValues(
  organization?: ClientResourceOrganization,
): OrganizationFormValues {
  return {
    Address: organization?.Address || '',
    Code: organization?.Code || '',
    CurrencyId: toOptionalEntityId(organization?.CurrencyId ?? organization?.Currency?.Id),
    FullName: organization?.FullName || '',
    IsIndividual: organization?.IsIndividual === true,
    IsVatAgreements: organization?.IsVatAgreements === true,
    MainPaymentRegisterId: toOptionalEntityId(
      organization?.MainPaymentRegister?.Id
      ?? organization?.PaymentRegisters?.find((register) => register.IsMain)?.Id
      ?? organization?.PaymentRegisters?.[0]?.Id,
    ),
    Manager: organization?.Manager || '',
    Name: getOrganizationFormName(organization),
    PFURegistrationDate: toDateFieldValue(organization?.PFURegistrationDate),
    PFURegistrationNumber: organization?.PFURegistrationNumber || '',
    PhoneNumber: organization?.PhoneNumber || '',
    RegistrationDate: toDateFieldValue(organization?.RegistrationDate),
    RegistrationNumber: organization?.RegistrationNumber || '',
    SROI: organization?.SROI || '',
    StorageId: toOptionalEntityId(organization?.StorageId ?? organization?.Storage?.Id),
    TIN: organization?.TIN || '',
    TaxInspectionId: toOptionalEntityId(
      organization?.TaxInspectionId ?? organization?.TaxInspection?.Id,
    ),
    TranslationName: getAlternativeTranslation(organization)?.Name?.trim() || '',
    TypeTaxation: String(organization?.TypeTaxation ?? 0),
    USREOU: organization?.USREOU || '',
    VatRateId: toOptionalEntityId(organization?.VatRateId ?? organization?.VatRate?.Id),
  }
}

function validateOrganizationForm(values: OrganizationFormValues): string | null {
  if (!values.Name.trim()) {
    return translate('Вкажіть назву організації')
  }

  return null
}

function buildOrganizationPayload(
  organization: ClientResourceOrganization | undefined,
  values: OrganizationFormValues,
  resources: {
    currencies: ClientResourceCurrency[]
    storages: ClientResourceStorage[]
    taxInspections: ClientResourceTaxInspection[]
    vatRates: ClientResourceVatRate[]
  },
): ClientResourceOrganization {
  const currency = findEntityById(resources.currencies, values.CurrencyId)
  const storage = findEntityById(resources.storages, values.StorageId)
  const taxInspection = findEntityById(resources.taxInspections, values.TaxInspectionId)
  const vatRate = findEntityById(resources.vatRates, values.VatRateId)
  const mainPaymentRegister = findEntityById(organization?.PaymentRegisters || [], values.MainPaymentRegisterId)

  return {
    ...(organization || {}),
    Address: values.Address.trim(),
    Code: values.Code.trim(),
    Culture: organization?.Culture || UKRAINE_CULTURE,
    Currency: currency,
    CurrencyId: currency?.Id,
    FullName: values.FullName.trim(),
    IsIndividual: values.IsIndividual,
    IsVatAgreements: values.IsVatAgreements,
    MainPaymentRegister: mainPaymentRegister,
    Manager: values.Manager.trim(),
    Name: values.Name.trim(),
    OrganizationTranslations: buildOrganizationTranslations(organization, values),
    PFURegistrationDate: dateInputToIsoString(values.PFURegistrationDate),
    PFURegistrationNumber: values.PFURegistrationNumber.trim(),
    PhoneNumber: values.PhoneNumber.trim(),
    RegistrationDate: dateInputToIsoString(values.RegistrationDate),
    RegistrationNumber: values.RegistrationNumber.trim(),
    SROI: values.SROI.trim(),
    Storage: storage,
    StorageId: storage?.Id,
    TIN: values.TIN.trim(),
    TaxInspection: taxInspection,
    TaxInspectionId: taxInspection?.Id,
    TypeTaxation: Number(values.TypeTaxation || 0),
    USREOU: values.USREOU.trim(),
    VatRate: vatRate,
    VatRateId: vatRate?.Id,
  }
}

function buildOrganizationTranslations(
  organization: ClientResourceOrganization | undefined,
  values: OrganizationFormValues,
): ClientResourceTranslation[] {
  const currentTranslations = organization?.OrganizationTranslations || []
  const ukTranslation = currentTranslations.find((translation) => translation.CultureCode === UKRAINE_CULTURE)
  const alternativeTranslation = getAlternativeTranslation(organization)
  const otherTranslations = currentTranslations.filter(
    (translation) => Boolean(translation.CultureCode) && translation.CultureCode !== UKRAINE_CULTURE,
  )
  const nextTranslations: ClientResourceTranslation[] = [
    {
      ...(ukTranslation || {}),
      CultureCode: UKRAINE_CULTURE,
      Name: values.Name.trim(),
    },
  ]

  otherTranslations.forEach((translation) => {
    nextTranslations.push({
      ...translation,
      Name: translation.CultureCode === alternativeTranslation?.CultureCode
        ? values.TranslationName.trim()
        : translation.Name,
    })
  })

  return nextTranslations
}

function getOrganizationFormName(organization?: ClientResourceOrganization): string {
  return (
    getUkrainianTranslationName(organization?.OrganizationTranslations)
    || organization?.Name
    || ''
  )
}

function getAlternativeTranslation(organization?: ClientResourceOrganization): ClientResourceTranslation | undefined {
  return organization?.OrganizationTranslations?.find(
    (translation) =>
      Boolean(translation.CultureCode)
      && translation.CultureCode !== UKRAINE_CULTURE
      && !isSkippedTranslationCulture(translation.CultureCode),
  )
}

function toEntityOptions<T extends ClientResourceEntity>(items: T[], getLabel: (item: T) => string) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    if (typeof item.Id === 'number') {
      options.push({
        value: String(item.Id),
        label: getLabel(item),
      })
    }

    return options
  }, [])
}

function findEntityById<T extends ClientResourceEntity>(items: T[], idValue: string): T | undefined {
  const id = Number(idValue)

  if (!Number.isFinite(id)) {
    return undefined
  }

  return items.find((item) => item.Id === id)
}

function isCalculatedPricingType(priceType?: ClientResourcePricingType): boolean {
  const normalizedName = (priceType?.Name || '').trim().toLocaleLowerCase('uk')

  return (
    normalizedName.includes('розрах')
    || normalizedName.includes('calculat')
    || normalizedName.includes('rozlicz')
  )
}

function shouldShowCalculatedPriceOptions(
  priceType?: ClientResourcePricingType,
  pricing?: ClientResourcePricing,
): boolean {
  if (isCalculatedPricingType(priceType)) {
    return true
  }

  if (!priceType?.Id || pricing?.PriceTypeId !== priceType.Id) {
    return false
  }

  return Boolean(pricing.BasePricingId || pricing.BasePricing || pricing.ExtraCharge)
}

function toOptionalEntityId(id: number | undefined): string {
  return typeof id === 'number' && Number.isFinite(id) ? String(id) : ''
}

function dateInputToIsoString(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString()
}

function toDateFieldValue(value: Date | string | undefined): string {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    return dateToInputValue(value)
  }

  const trimmedValue = value.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmedValue)) {
    return trimmedValue.slice(0, 10)
  }

  const parsedValue = new Date(trimmedValue)

  return Number.isNaN(parsedValue.getTime()) ? '' : dateToInputValue(parsedValue)
}

function dateToInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatVatRate(vatRate: ClientResourceVatRate): string {
  return typeof vatRate.Value === 'number' && Number.isFinite(vatRate.Value)
    ? `${vatRate.Value}%`
    : displayValue(vatRate.Value)
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'boolean') {
    return value ? translate('Так') : translate('Ні')
  }

  return '—'
}

function displayCurrency(currency?: ClientResourceCurrency): string {
  if (!currency) {
    return '—'
  }

  const translatedName = displayTranslatedEntity(currency.Name, currency.CurrencyTranslations)

  if (currency.Code && translatedName !== '—') {
    return `${currency.Code} · ${translatedName}`
  }

  return currency.Code || translatedName
}

function displayTranslatedEntity(baseName?: string, translations?: ClientResourceTranslation[]): string {
  return getUkrainianTranslationName(translations) || displayValue(baseName)
}

function displayTranslationBadges(translations?: ClientResourceTranslation[]) {
  const names = getTranslationNames(translations)

  if (!names.length) {
    return '—'
  }

  return (
    <Group gap={6}>
      {names.map((name) => (
        <Badge color="gray" variant="light" key={name}>
          {name}
        </Badge>
      ))}
    </Group>
  )
}

function getTranslationNames(translations?: ClientResourceTranslation[]): string[] {
  return (translations || []).reduce<string[]>((names, translation) => {
    if (isSkippedTranslationCulture(translation.CultureCode)) {
      return names
    }

    const name = translation.Name?.trim()

    if (name) {
      names.push(name)
    }

    return names
  }, [])
}

function getUkrainianTranslationName(translations?: ClientResourceTranslation[]): string {
  return translations?.find((translation) => translation.CultureCode === UKRAINE_CULTURE)?.Name?.trim() || ''
}

function isSkippedTranslationCulture(cultureCode?: string): boolean {
  const normalizedCulture = cultureCode?.toLowerCase()

  return Boolean(normalizedCulture && (
    SKIPPED_TRANSLATION_CULTURES.has(normalizedCulture) || normalizedCulture.startsWith('pl-')
  ))
}

function matchesSearch(search: string, values: unknown[]): boolean {
  const query = search.trim().toLowerCase()

  if (!query) {
    return true
  }

  return values.some((value) => {
    if (value === null || typeof value === 'undefined') {
      return false
    }

    return String(value).toLowerCase().includes(query)
  })
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return `${value}%`
}
