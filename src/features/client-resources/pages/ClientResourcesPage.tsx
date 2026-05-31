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
  IconMap,
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
import { useNavigate, useParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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
  density: 'normal',
} satisfies DataTableDefaultLayout

type ResourceDataTableProps<TData extends ClientResourceEntity> = {
  columns: DataTableColumn<TData>[]
  data: TData[]
  emptyText?: ReactNode
  minWidth?: number
  tableId: string
}

function ResourceDataTable<TData extends ClientResourceEntity>({
  columns,
  data,
  emptyText,
  minWidth = 760,
  tableId,
}: ResourceDataTableProps<TData>) {
  return (
    <DataTable
      columns={columns}
      data={data}
      defaultLayout={CLIENT_RESOURCE_TABLE_DEFAULT_LAYOUT}
      emptyText={emptyText}
      getRowId={(row, index) => getEntityKey(row, index)}
      layoutVersion="client-resources-table-1"
      maxHeight="min(56vh, 620px)"
      minWidth={minWidth}
      tableId={`client-resources-${normalizeTableIdPart(tableId)}`}
    />
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
    step: 'map',
    label: 'Мапа',
    description: 'Карта регіонів',
    icon: IconMap,
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
            color="violet"
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
    case 'map':
      return <MapPanel section={section} />
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
    selectedRegion, state, confirmDeleteRegionTarget, openCreateRegion, openCreateRegionCode, openEditRegion,
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
    selectedRegion, state, confirmDeleteRegionTarget, openCreateRegion, openCreateRegionCode, openEditRegion,
    openEditRegionCode, saveRegion, saveRegionCode, setDeleteTarget, setFormError, setRegionCodeEditor,
    setRegionEditor, setSearch, setSelectedRegionId,
  } = model
  const createRegionAction = (
    <PermissionGate permissionKey={REGION_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateRegion}>
        Новий регіон
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createRegionAction} section={section}>
      <PanelToolbar
        count={filteredRegions.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
        searchValue={search}
      />
      <Loadable state={state} emptyTitle="Регіонів не знайдено">
        {filteredRegions.length ? (
          <Box className="client-resources-regions-grid">
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
                      <Badge variant="light" color={isActive ? 'violet' : 'gray'}>
                        {region.RegionCodes?.length || 0}
                      </Badge>
                      <PermissionGate permissionKey={REGION_CODE_CREATE_PERMISSION}>
                        <Tooltip label={translate("Додати код")}>
                          <ActionIcon
                            aria-label={translate("Додати код регіону")}
                            color="violet"
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
            <Box>
              <Group justify="space-between" mb="sm">
                <div>
                  <Text fw={700}>{displayValue(selectedRegion?.Name)}</Text>
                  <Text size="xs" c="dimmed">
                    Коди регіону
                  </Text>
                </div>
                <Badge variant="light" color="gray">
                  {selectedRegion?.RegionCodes?.length || 0}
                </Badge>
                {selectedRegion ? (
                  <PermissionGate permissionKey={REGION_CODE_CREATE_PERMISSION}>
                    <Tooltip label={translate("Додати код регіону")}>
                      <ActionIcon
                        aria-label={translate("Додати код регіону")}
                        color="violet"
                        variant="light"
                        onClick={() => openCreateRegionCode(selectedRegion)}
                      >
                        <IconPlus size={17} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                ) : null}
              </Group>
              {selectedRegion?.RegionCodes?.length ? (
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
                  data={selectedRegion.RegionCodes}
                  emptyText={translate("Кодів регіону немає")}
                  minWidth={620}
                  tableId="region-codes"
                />
              ) : (
                <EmptyState title={translate("Кодів регіону немає")} />
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
            maxLength={20}
            placeholder={translate("Код регіону")}
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              Скасувати
            </Button>
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
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
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
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
  const clientTypesState = useResourceData<ClientResourceClientType[]>(getClientResourceClientTypes, [])
  const [roleId, setRoleId] = useValueState<string | null>(null)
  const [editor, setEditor] = useValueState<PerfectClientEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const roleOptions = useMemo(() => getRoleSelectOptions(getBuyerRoles(clientTypesState.data)), [clientTypesState.data])
  const effectiveRoleId = roleId || roleOptions[0]?.value || null
  const selectedRole = useMemo(
    () => getBuyerRoles(clientTypesState.data).find((role) => String(role.Id) === effectiveRoleId),
    [clientTypesState.data, effectiveRoleId],
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

  return (
    <ResourcePanel section={section}>
      <Group justify="space-between" align="flex-end" mb="md">
        <Select
          data={roleOptions}
          label={translate("Роль клієнта")}
          maw={360}
          nothingFoundMessage={translate("Ролей не знайдено")}
          onChange={setRoleId}
          placeholder={translate("Оберіть роль")}
          value={effectiveRoleId}
        />
        <Group gap="xs">
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
      </Group>
      <Loadable state={clientTypesState} emptyTitle="Ролей клієнтів не знайдено">
        <Loadable state={perfectClientsState} emptyTitle="Параметрів для ролі не знайдено">
          {selectedRole ? (
            <Stack gap="xl">
              <Group justify="space-between">
                <div>
                  <Text fw={700}>{displayValue(selectedRole.Name)}</Text>
                  <Text size="xs" c="dimmed">
                    {displayValue(selectedRole.Description)}
                  </Text>
                </div>
                <Badge variant="light" color="gray">
                  {perfectClientsState.data.length}
                </Badge>
              </Group>
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
            </Stack>
          ) : (
            <EmptyState title={translate("Оберіть роль клієнта")} />
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
    <Box>
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{title}</Text>
        <Badge variant="light" color="gray">
          {items.length}
        </Badge>
      </Group>
      {items.length ? (
        <ResourceDataTable
          columns={[
            {
              id: 'name',
              header: 'Назва',
              accessor: (item) => displayTranslatedEntity(item.Name, item.PerfectClientTranslations),
              minWidth: 200,
            },
            {
              id: 'label',
              header: 'Мітка',
              accessor: (item) => item.Lable,
              minWidth: 160,
            },
            {
              id: 'value',
              header: 'Значення',
              accessor: (item) => item.Value,
              minWidth: 140,
            },
            {
              id: 'description',
              header: 'Опис',
              accessor: (item) => item.Description,
              minWidth: 220,
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
              cell: (item) => (
                <Group gap={4} justify="flex-end" wrap="nowrap">
                  <PermissionGate permissionKey={PERFECT_CLIENT_EDIT_PERMISSION}>
                    <Tooltip label={translate("Редагувати")}>
                      <ActionIcon
                        aria-label={translate("Редагувати параметр")}
                        color="gray"
                        size="sm"
                        variant="subtle"
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
                        variant="subtle"
                        onClick={() => onDelete(item)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                </Group>
              ),
            },
          ]}
          data={items}
          emptyText={translate("Записів немає")}
          minWidth={860}
          tableId={`perfect-clients-${title}`}
        />
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
              { value: String(PERFECT_CLIENT_CHECKBOX_TYPE), label: translate('Прапорець') },
              { value: String(PERFECT_CLIENT_TOGGLE_TYPE), label: translate('Перемикач') },
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
              label={translate("Номер")}
              value={values.InspectionNumber}
              onChange={(event) => setField('InspectionNumber', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Тип")}
              value={values.InspectionType}
              onChange={(event) => setField('InspectionType', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Регіон")}
              value={values.InspectionRegionName}
              onChange={(event) => setField('InspectionRegionName', event.currentTarget.value)}
            />
            <TextInput
              label={translate("Код регіону")}
              value={values.InspectionRegionCode}
              onChange={(event) => setField('InspectionRegionCode', event.currentTarget.value)}
            />
            <TextInput
              label={translate("ЄДРПОУ")}
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
      <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
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
  const createOrganizationAction = (
    <PermissionGate permissionKey={ORGANIZATION_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateOrganization}>
        Нова організація
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createOrganizationAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
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
                minWidth: 200,
              },
              {
                id: 'fullName',
                header: 'Повна назва',
                accessor: (organization) => organization.FullName,
                minWidth: 220,
              },
              {
                id: 'code',
                header: 'Код',
                accessor: (organization) => organization.Code,
                width: 120,
              },
              {
                id: 'usreou',
                header: 'ЄДРПОУ',
                accessor: (organization) => organization.USREOU,
                width: 130,
              },
              {
                id: 'tin',
                header: 'ІПН',
                accessor: (organization) => organization.TIN,
                width: 130,
              },
              {
                id: 'currency',
                header: 'Валюта',
                accessor: (organization) => displayCurrency(organization.Currency),
                width: 130,
              },
              {
                id: 'taxInspection',
                header: 'Податкова',
                accessor: (organization) => organization.TaxInspection?.InspectionName,
                minWidth: 220,
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
            emptyText={translate("За цим пошуком немає організацій")}
            minWidth={1360}
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
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
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
        message: editor?.mode === 'edit' ? translate('Податкову оновлено') : translate('Податкову створено'),
      })
      setEditor(null)
      state.reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : translate('Не вдалося зберегти податкову'))
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
      setFormError(translate('Податкова не має NetUid'))
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      await deleteClientResourceTaxInspection(netId)
      notifications.show({ color: 'green', message: translate('Податкову видалено') })
      setDeleteTarget(null)
      state.reload()
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : translate('Не вдалося видалити податкову'))
    } finally {
      setSaving(false)
    }
  }
  const createTaxInspectionAction = (
    <PermissionGate permissionKey={TAX_INSPECTION_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateTaxInspection}>
        Нова податкова
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createTaxInspectionAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
        searchValue={search}
      />
      <Loadable state={state} emptyTitle="Податкових інспекцій не знайдено">
        {filtered.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'name',
                header: 'Назва',
                accessor: (inspection) => inspection.InspectionName,
                minWidth: 220,
              },
              {
                id: 'number',
                header: 'Номер',
                accessor: (inspection) => inspection.InspectionNumber,
                width: 130,
              },
              {
                id: 'regionCode',
                header: 'Код регіону',
                accessor: (inspection) => inspection.InspectionRegionCode,
                width: 140,
              },
              {
                id: 'region',
                header: 'Регіон',
                accessor: (inspection) => inspection.InspectionRegionName,
                minWidth: 180,
              },
              {
                id: 'type',
                header: 'Тип',
                accessor: (inspection) => inspection.InspectionType,
                width: 130,
              },
              {
                id: 'usreou',
                header: 'ЄДРПОУ',
                accessor: (inspection) => inspection.InspectionUSREOU,
                width: 130,
              },
              {
                id: 'address',
                header: 'Адреса',
                accessor: (inspection) => inspection.InspectionAddress,
                minWidth: 220,
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
                cell: (inspection) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <PermissionGate permissionKey={TAX_INSPECTION_EDIT_PERMISSION}>
                      <Tooltip label={translate("Редагувати")}>
                        <ActionIcon
                          aria-label={translate("Редагувати податкову")}
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
                          aria-label={translate("Видалити податкову")}
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
            emptyText={translate("За цим пошуком немає інспекцій")}
            minWidth={1370}
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
        title={editor?.mode === 'edit' ? translate('Редагувати податкову') : translate('Нова податкова')}
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
  const createPricingAction = (
    <PermissionGate permissionKey={PRICING_CREATE_PERMISSION}>
      <Button
        color="violet"
        disabled={isPricingSupportBlocked}
        leftSection={<IconPlus size={16} />}
        loading={isLoadingSupport}
        size="xs"
        onClick={openCreatePricing}
      >
        Нове правило
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createPricingAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
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
  isSaving: boolean
  pricings: ClientResourcePricing[]
  onChangePriority: (pricing: ClientResourcePricing, raise: boolean) => void
  onDelete: (pricing: ClientResourcePricing) => void
  onEdit: (pricing: ClientResourcePricing) => void
}

function PricingResourceTable({
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
        width: 160,
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
        minWidth: 200,
      },
      {
        id: 'markup',
        header: 'Націнка',
        accessor: (pricing) => pricing.ExtraCharge,
        cell: (pricing) => formatPercent(pricing.ExtraCharge),
        width: 120,
      },
      {
        id: 'currency',
        header: 'Валюта',
        accessor: (pricing) => displayCurrency(pricing.Currency),
        width: 120,
      },
      {
        id: 'priceType',
        header: 'Тип ціни',
        accessor: (pricing) => pricing.PriceType?.Name,
        minWidth: 160,
      },
      {
        id: 'base',
        header: 'База',
        accessor: (pricing) => displayTranslatedEntity(pricing.BasePricing?.Name, pricing.BasePricing?.PricingTranslations),
        minWidth: 180,
      },
      {
        id: 'vat',
        header: 'ПДВ',
        accessor: (pricing) => pricing.ForVat,
        cell: (pricing) => <BooleanBadge value={pricing.ForVat} />,
        width: 100,
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
      emptyText={translate("За цим пошуком немає правил")}
      minWidth={1240}
      tableId="pricing"
    />
  )
}

function MapPanel({ section }: { section: ClientResourceSection }) {
  return (
    <ResourcePanel section={section}>
      <EmptyState
        icon={IconMap}
        title={translate("Карта недоступна")}
        message={translate("Для цього розділу немає даних для відображення.")}
      />
    </ResourcePanel>
  )
}

function CurrenciesPanel({ section }: { section: ClientResourceSection }) {
  const state = useResourceData<ClientResourceCurrency[]>(getClientResourceCurrencies, [])
  const [search, setSearch] = useValueState('')
  const [editor, setEditor] = useValueState<CurrencyEditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<ClientResourceDeleteTarget | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
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
  const createCurrencyAction = (
    <PermissionGate permissionKey={CURRENCY_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateCurrency}>
        Нова валюта
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createCurrencyAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
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
                width: 120,
              },
              {
                id: 'name',
                header: 'Назва',
                accessor: (currency) => currency.Name,
                minWidth: 200,
              },
              {
                id: 'translations',
                header: 'Переклади',
                accessor: (currency) => (currency.CurrencyTranslations || []).map((translation) => translation.CultureCode).join(', '),
                cell: (currency) => displayTranslationBadges(currency.CurrencyTranslations),
                minWidth: 220,
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
            emptyText={translate("За цим пошуком немає валют")}
            minWidth={760}
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
  const createStorageAction = (
    <PermissionGate permissionKey={STORAGE_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateStorage}>
        Новий склад
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createStorageAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
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
                minWidth: 220,
              },
              {
                id: 'organization',
                header: 'Організація',
                accessor: (storage) => storage.Organization?.Name,
                minWidth: 200,
              },
              {
                id: 'priority',
                header: 'Пріоритет',
                accessor: (storage) => storage.RetailPriority,
                width: 120,
              },
              {
                id: 'defective',
                header: 'Брак',
                accessor: (storage) => storage.ForDefective,
                cell: (storage) => <BooleanBadge value={storage.ForDefective} />,
                width: 100,
              },
              {
                id: 'vat',
                header: 'ПДВ',
                accessor: (storage) => storage.ForVatProducts,
                cell: (storage) => <BooleanBadge value={storage.ForVatProducts} />,
                width: 100,
              },
              {
                id: 'ecommerce',
                header: 'Інтернет-магазин',
                accessor: (storage) => storage.ForEcommerce,
                cell: (storage) => <BooleanBadge value={storage.ForEcommerce} />,
                width: 160,
              },
              {
                id: 'resale',
                header: 'Перепродаж',
                accessor: (storage) => storage.IsResale || storage.AvailableForReSale,
                cell: (storage) => <BooleanBadge value={storage.IsResale || storage.AvailableForReSale} />,
                width: 130,
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
            emptyText={translate("За цим пошуком немає складів")}
            minWidth={1260}
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
  const createMeasureUnitAction = (
    <PermissionGate permissionKey={MEASURE_UNIT_CREATE_PERMISSION}>
      <Button color="violet" leftSection={<IconPlus size={16} />} size="xs" onClick={openCreateMeasureUnit}>
        Нова одиниця
      </Button>
    </PermissionGate>
  )

  return (
    <ResourcePanel action={createMeasureUnitAction} section={section}>
      <PanelToolbar
        count={filtered.length}
        isLoading={state.isLoading}
        onRefresh={state.reload}
        onSearchChange={setSearch}
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
                width: 140,
              },
              {
                id: 'name',
                header: 'Назва',
                accessor: (measureUnit) => measureUnit.Name,
                minWidth: 180,
              },
              {
                id: 'description',
                header: 'Повна назва',
                accessor: (measureUnit) => measureUnit.Description,
                minWidth: 220,
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
            emptyText={translate("За цим пошуком немає одиниць")}
            minWidth={760}
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
    <ResourcePanel section={section}>
      <PanelToolbar count={roles.length} isLoading={state.isLoading} onRefresh={state.reload} />
      <Loadable state={state} emptyTitle="Ролей клієнтів не знайдено">
        {roles.length ? (
          <ResourceDataTable
            columns={[
              {
                id: 'role',
                header: 'Роль',
                accessor: (role) => role.Name,
                minWidth: 220,
                cell: (role) => (
                  <Button
                    color="violet"
                    disabled={!role.Id}
                    rightSection={<IconExternalLink size={14} />}
                    size="xs"
                    variant="subtle"
                    onClick={() => openClientsForRole(role)}
                  >
                    {displayValue(role.Name)}
                  </Button>
                ),
              },
              {
                id: 'description',
                header: 'Опис',
                accessor: (role) => role.Description,
                minWidth: 220,
              },
              {
                id: 'reserveDays',
                header: 'Днів резерву',
                accessor: (role) => role.OrderExpireDays,
                width: 150,
                cell: (role) => (
                  <Badge color="violet" variant="light">
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
            emptyText={translate("Ролей покупців не знайдено")}
            minWidth={760}
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

  return (
    <ResourcePanel section={section}>
      <Group justify="space-between" align="flex-end" mb="md">
        <Select
          data={typeOptions}
          label={translate("Тип перевізника")}
          maw={360}
          nothingFoundMessage={translate("Типів не знайдено")}
          onChange={setTypeNetId}
          placeholder={translate("Оберіть тип")}
          value={effectiveTypeNetId}
        />
        <Group gap="xs">
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
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{title}</Text>
        <Badge variant="light" color="gray">
          {transporters.length}
        </Badge>
      </Group>
      {transporters.length ? (
        <ResourceDataTable
          columns={[
            {
              id: 'transporter',
              header: 'Перевізник',
              accessor: (transporter) => transporter.Name,
              minWidth: 240,
              cell: (transporter) => (
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={transporter.ImageUrl} alt={displayValue(transporter.Name)} size="sm" radius="sm" />
                  <Text fw={600}>{displayValue(transporter.Name)}</Text>
                </Group>
              ),
            },
            {
              id: 'type',
              header: 'Тип',
              accessor: (transporter) => transporter.TransporterType?.Name,
              minWidth: 180,
            },
            {
              id: 'priority',
              header: 'Пріоритет',
              accessor: (transporter) => transporter.Priority,
              width: 130,
            },
            ...(showActions
              ? [
                  {
                    id: 'actions',
                    header: '',
                    align: 'right' as const,
                    width: 96,
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
          minWidth={showActions ? 760 : 640}
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
      {action ? (
        <Group justify="flex-end" wrap="nowrap" mb="md">
          {action}
        </Group>
      ) : null}
      {children}
    </section>
  )
}

function PanelToolbar({
  action,
  count,
  isLoading,
  onRefresh,
  onSearchChange,
  searchValue,
}: {
  action?: ReactNode
  count: number
  isLoading: boolean
  onRefresh: () => void
  onSearchChange?: (value: string) => void
  searchValue?: string
}) {
  const { t } = useI18n()

  return (
    <Group justify="space-between" align="center" mb="md" gap="sm">
      {onSearchChange ? (
        <TextInput
          className="client-resources-search"
          leftSection={<IconSearch size={16} stroke={1.8} />}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={t('Пошук')}
          value={searchValue}
        />
      ) : (
        <span />
      )}
      <Group gap="xs">
        <Badge color="gray" variant="light">
          {count}
        </Badge>
        <RefreshControl isLoading={isLoading} onRefresh={onRefresh} />
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

  if (normalizedName.length > 20) {
    return translate('Назва регіону має бути не довша за 20 символів')
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
    return `${translate('Видалити податкову')} "${displayValue(target.taxInspection.InspectionName)}"?`
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
      ? buildPerfectClientValues(perfectClient?.Values, values.ToggleValueLeft, values.ToggleValueRight)
      : [],
  }
}

function buildPerfectClientValues(
  currentValues: ClientResourcePerfectClientValue[] | undefined,
  leftValue: string,
  rightValue: string,
): ClientResourcePerfectClientValue[] {
  return [
    buildPerfectClientValue(currentValues?.[0], leftValue.trim()),
    buildPerfectClientValue(currentValues?.[1], rightValue.trim()),
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
    (translation) => translation.CultureCode && translation.CultureCode !== UKRAINE_CULTURE,
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
    value?.PerfectClientValueTranslations?.find((translation) => translation.CultureCode === UKRAINE_CULTURE)?.Value
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
    Locale: UKRAINE_CULTURE,
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
    (translation) => translation.CultureCode && translation.CultureCode !== UKRAINE_CULTURE,
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
    TranslationName: getAlternativeTranslation(organization)?.Name || '',
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
    (translation) => translation.CultureCode && translation.CultureCode !== UKRAINE_CULTURE,
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
