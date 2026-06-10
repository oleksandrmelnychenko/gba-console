import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  FileInput,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconBuildingWarehouse,
  IconCheck,
  IconCreditCard,
  IconDeviceFloppy,
  IconFileText,
  IconInfoCircle,
  IconLink,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { type CSSProperties, type FormEvent, type MouseEventHandler, type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import type { TranslationKey } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  CREATE_ACTION_COLOR,
  PageHeaderActions,
} from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePageBreadcrumb } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'
import {
  addEcommerceStorage,
  createSeoContact,
  getAllOnlineShopStorages,
  getEcommerceStorages,
  getOnlineShopSeoSettings,
  getOnlineShopClients,
  getOnlineShopPaymentRegisters,
  removeEcommerceStorage,
  removeSeoContact,
  selectOnlineShopPaymentRegister,
  toggleOnlineShopClient,
  updateSeoContact,
  updateSeoContactInfo,
  updateEcommerceStoragePriority,
  updateSeoPage,
  updateSeoPaymentInfo,
  uploadSeoContactImage,
} from '../api/onlineShopSeoApi'
import {
  ContactInfoForm,
  PaymentInfoForm,
  SearchToolbar,
} from '../components/OnlineShopSeoControls'
import type {
  OnlineShopClient,
  OnlineShopPaymentRegister,
  OnlineShopStorage,
  SeoContact,
  SeoContactFormValues,
  SeoContactInfo,
  SeoContactInfoFormValues,
  SeoLocaleEntry,
  SeoPageRow,
  SeoPaymentFormValues,
  SeoRetailPaymentInfo,
} from '../types'
import {
  contactToFormValues,
  displayValue,
  formatDateTime,
  getAllPageRows,
  getLocaleLabel,
  getPageTitle,
  getSeoContactDisplayName,
  getUniqueContacts,
  hasPaymentRecord,
  pageToFormValues,
  validateContact,
  validatePage,
} from '../utils'
import './online-shop-seo-page.css'

type SeoTab = 'pages' | 'info-payment' | 'contacts' | 'shop-clients' | 'bank-cards' | 'warehouses'

type SeoRosterColumn<TData> = {
  id: string
  header: ReactNode
  accessor?: (row: TData) => unknown
  cell?: (row: TData) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  className?: string
  fill?: boolean
  enableHiding?: boolean
  enablePinning?: boolean
  enableReorder?: boolean
  enableResizing?: boolean
  enableSorting?: boolean
}

const SEO_TABS: { value: SeoTab; label: TranslationKey }[] = [
  { value: 'info-payment', label: 'Загальна інформація та оплата' },
  { value: 'pages', label: 'Сторінки' },
  { value: 'contacts', label: 'Персонал' },
  { value: 'shop-clients', label: 'Інтернет клієнти' },
  { value: 'bank-cards', label: 'Банківські картки' },
  { value: 'warehouses', label: 'Склади' },
]

const DEFAULT_SEO_TAB: SeoTab = 'info-payment'
const SEO_TAB_VALUES = new Set<SeoTab>(SEO_TABS.map((tab) => tab.value))

const EMPTY_PAGE_FORM_VALUES = pageToFormValues(null)
const EMPTY_CONTACT_FORM_VALUES = contactToFormValues(null)

type SeoGeneralMatrixGroup = 'contact' | 'payment'
type SeoGeneralContactFieldId = keyof SeoContactInfoFormValues
type SeoGeneralPaymentFieldId = keyof SeoPaymentFormValues

type SeoGeneralMatrixField =
  | {
    description: TranslationKey
    group: 'contact'
    id: SeoGeneralContactFieldId
    input: 'text' | 'textarea'
    label: TranslationKey
  }
  | {
    description: TranslationKey
    group: 'payment'
    id: SeoGeneralPaymentFieldId
    input: 'text' | 'textarea'
    label: TranslationKey
  }

type SeoGeneralMatrixSection = {
  description: TranslationKey
  fields: SeoGeneralMatrixField[]
  group: SeoGeneralMatrixGroup
  label: TranslationKey
}

const SEO_GENERAL_MATRIX_SECTIONS: SeoGeneralMatrixSection[] = [
  {
    description: 'Адреса, телефон, пошта, сайт і Pixel ID',
    fields: [
      { description: 'Публічна адреса магазину', group: 'contact', id: 'Address', input: 'textarea', label: 'Адреса' },
      { description: 'Основний телефон для клієнтів', group: 'contact', id: 'Phone', input: 'text', label: 'Телефон' },
      { description: 'Поштова скринька магазину', group: 'contact', id: 'Email', input: 'text', label: 'E-mail' },
      { description: 'Посилання на сайт', group: 'contact', id: 'SiteUrl', input: 'text', label: 'Site URL' },
      { description: 'Ідентифікатор рекламного пікселя', group: 'contact', id: 'PixelId', input: 'text', label: 'Pixel ID' },
    ],
    group: 'contact',
    label: 'Загальна інформація',
  },
  {
    description: 'Суми, коментарі та повідомлення оформлення',
    fields: [
      { description: 'Текст або сума передплати', group: 'payment', id: 'LowPrice', input: 'text', label: 'Передплата' },
      { description: 'Текст або сума повної ціни', group: 'payment', id: 'FullPrice', input: 'text', label: 'Повна ціна' },
      { description: 'Коментар для платіжної картки', group: 'payment', id: 'Comment', input: 'textarea', label: 'Коментар для картки' },
      {
        description: 'Текст після швидкого замовлення',
        group: 'payment',
        id: 'FastOrderSuccessMessage',
        input: 'textarea',
        label: 'Повідомлення про успішне замовлення',
      },
      { description: 'Повідомлення для сценарію зі скріншотом', group: 'payment', id: 'ScreenshotMessage', input: 'textarea', label: 'Повідомлення' },
    ],
    group: 'payment',
    label: 'Оплата',
  },
]

function useOnlineShopSeoPageModel(activeTab: SeoTab, setActiveTab: (tab: SeoTab) => void) {
  const { t } = useI18n()
  const [settings, setSettings] = useValueState<SeoLocaleEntry[]>([])
  const [pageSearchDraft, setPageSearchDraft] = useValueState('')
  const [pageSearchValue, setPageSearchValue] = useValueState('')
  const [contactSearchDraft, setContactSearchDraft] = useValueState('')
  const [contactSearchValue, setContactSearchValue] = useValueState('')
  const [clientSearchDraft, setClientSearchDraft] = useValueState('')
  const [clientSearchValue, setClientSearchValue] = useValueState('')
  const [cardSearchDraft, setCardSearchDraft] = useValueState('')
  const [cardSearchValue, setCardSearchValue] = useValueState('')
  const [storageSearchDraft, setStorageSearchDraft] = useValueState('')
  const [storageSearchValue, setStorageSearchValue] = useValueState('')
  const [allStorageSearchDraft, setAllStorageSearchDraft] = useValueState('')
  const [allStorageSearchValue, setAllStorageSearchValue] = useValueState('')
  const [editingGeneralLocale, setEditingGeneralLocale] = useValueState<string | null>(null)
  const [onlineShopClients, setOnlineShopClients] = useValueState<OnlineShopClient[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<OnlineShopPaymentRegister[]>([])
  const [ecommerceStorages, setEcommerceStorages] = useValueState<OnlineShopStorage[]>([])
  const [allStorages, setAllStorages] = useValueState<OnlineShopStorage[]>([])
  const [selectedPageRow, setSelectedPageRow] = useReducer(
    (_row: SeoPageRow | null, nextRow: SeoPageRow | null) => nextRow,
    null,
  )
  const [pageFormValues, setPageFormValues] = useValueState(EMPTY_PAGE_FORM_VALUES)
  const [editingContact, setEditingContact] = useValueState<SeoContact | null>(null)
  const [contactFormValues, setContactFormValues] = useValueState<SeoContactFormValues>(EMPTY_CONTACT_FORM_VALUES)
  const [removeContactTarget, setRemoveContactTarget] = useValueState<SeoContact | null>(null)
  const [removeStorageTarget, setRemoveStorageTarget] = useValueState<OnlineShopStorage | null>(null)
  const [priorityStorageTarget, setPriorityStorageTarget] = useValueState<OnlineShopStorage | null>(null)
  const [priorityValue, setPriorityValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isClientsLoading, setClientsLoading] = useValueState(true)
  const [isCardsLoading, setCardsLoading] = useValueState(true)
  const [isStoragesLoading, setStoragesLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isImageUploading, setImageUploading] = useValueState(false)
  const [isPageEditorOpen, setPageEditorOpen] = useValueState(false)
  const [isContactEditorOpen, setContactEditorOpen] = useValueState(false)
  const [isStorageDrawerOpen, setStorageDrawerOpen] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const pageRows = useMemo(
    () => filterPageRows(getAllPageRows(settings), pageSearchValue),
    [pageSearchValue, settings],
  )
  const contacts = useMemo(
    () => filterContacts(getUniqueContacts(settings), contactSearchValue),
    [contactSearchValue, settings],
  )
  const clients = useMemo(
    () => filterOnlineShopClients(onlineShopClients, clientSearchValue),
    [clientSearchValue, onlineShopClients],
  )
  const cards = useMemo(
    () => filterPaymentRegisters(paymentRegisters, cardSearchValue),
    [cardSearchValue, paymentRegisters],
  )
  const activeStorages = useMemo(
    () => filterStorages(ecommerceStorages, storageSearchValue),
    [ecommerceStorages, storageSearchValue],
  )
  const availableStorages = useMemo(
    () => filterStorages(markEcommerceStorages(allStorages, ecommerceStorages), allStorageSearchValue),
    [allStorageSearchValue, allStorages, ecommerceStorages],
  )
  const openPageEditor = useCallback((row: SeoPageRow) => {
    setSelectedPageRow(row)
    setPageFormValues(pageToFormValues(row.page))
    setFormError(null)
    setPageEditorOpen(true)
  }, [setFormError, setPageEditorOpen, setPageFormValues])

  const openContactEditor = useCallback((contact?: SeoContact) => {
    setEditingContact(contact || null)
    setContactFormValues(contactToFormValues(contact))
    setFormError(null)
    setContactEditorOpen(true)
  }, [setContactEditorOpen, setContactFormValues, setEditingContact, setFormError])

  const requestRemoveContact = useCallback((contact: SeoContact) => {
    setRemoveContactTarget(contact)
    setContactEditorOpen(false)
    setFormError(null)
  }, [setContactEditorOpen, setFormError, setRemoveContactTarget])

  const openPriorityEditor = useCallback((storage: OnlineShopStorage) => {
    setPriorityStorageTarget(storage)
    setPriorityValue(String(storage.RetailPriority ?? ''))
    setFormError(null)
  }, [setFormError, setPriorityStorageTarget, setPriorityValue])

  const requestRemoveStorage = useCallback((storage: OnlineShopStorage) => {
    setRemoveStorageTarget(storage)
    setFormError(null)
  }, [setFormError, setRemoveStorageTarget])

  const pageColumns = useMemo<SeoRosterColumn<SeoPageRow>[]>(
    () => [
      {
        id: 'page',
        header: 'Сторінка',
        width: 250,
        minWidth: 180,
        accessor: (row) => getPageTitle(row.page),
        cell: (row) => (
          <SeoTablePrimaryCell
            icon={<IconFileText size={15} />}
            subtitle={shortText(row.page.Description, 120)}
            title={displayValue(getPageTitle(row.page))}
          />
        ),
      },
      {
        id: 'url',
        header: 'URL',
        width: 220,
        minWidth: 180,
        accessor: (row) => row.page.Url,
        cell: (row) => (
          <SeoTableRoleLikeCell icon={<IconLink size={14} />} tone="url">
            {displayValue(row.page.Url)}
          </SeoTableRoleLikeCell>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        width: 260,
        minWidth: 220,
        accessor: (row) => row.page.Title,
        cell: (row) => (
          <SeoTableTextCell primary={shortText(row.page.Title, 120)} />
        ),
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (row) => row.locale,
        cell: (row) => <SeoTableLocaleTag>{getLocaleLabel(row.locale)}</SeoTableLocaleTag>,
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (row) => formatDateTime(row.page.Updated),
        cell: (row) => <SeoTableDateCell value={row.page.Updated} />,
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (row) => (
          <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon aria-label={t('Редагувати')} color="gray" variant="subtle" onClick={() => openPageEditor(row)}>
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [openPageEditor, t],
  )

  const contactColumns = useMemo<SeoRosterColumn<SeoContact>[]>(
    () => [
      {
        id: 'contact',
        header: 'Контакт',
        width: 260,
        minWidth: 220,
        accessor: getSeoContactDisplayName,
        cell: (contact) => {
          const contactName = getSeoContactDisplayName(contact)

          return (
            <SeoTablePrimaryCell
              avatar={(
                <Avatar className="seo-table-avatar" name={contactName || undefined} radius="xl" src={contact.ImgUrl || undefined}>
                  {getContactInitials(contact)}
                </Avatar>
              )}
              title={displayValue(contactName)}
            />
          )
        },
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (contact) => contact.Phone,
        cell: (contact) => <SeoTableTextCell primary={displayValue(contact.Phone)} />,
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (contact) => contact.Email,
        cell: (contact) => <SeoTableMutedCell>{displayValue(contact.Email)}</SeoTableMutedCell>,
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (contact) => formatDateTime(contact.Updated),
        cell: (contact) => <SeoTableDateCell value={contact.Updated} />,
      },
      {
        id: 'actions',
        header: '',
        width: 94,
        minWidth: 94,
        maxWidth: 94,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (contact) => (
          <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="gray"
                variant="subtle"
                onClick={() => openContactEditor(contact)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={!contact.NetUid}
                variant="subtle"
                onClick={() => requestRemoveContact(contact)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [openContactEditor, requestRemoveContact, t],
  )

  const clientColumns: SeoRosterColumn<OnlineShopClient>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 132,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsForRetail),
        cell: (client) => <SeoTableStatusPill active={Boolean(client.IsForRetail)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 280,
        minWidth: 220,
        accessor: (client) => getClientDisplayName(client),
        cell: (client) => (
          <SeoTablePrimaryCell
            avatar={(
              <Avatar className="seo-table-avatar" radius="xl">
                {getClientInitials(client)}
              </Avatar>
            )}
            title={displayValue(getClientDisplayName(client))}
          />
        ),
      },
      {
        id: 'clientNumber',
        header: 'Номер',
        width: 140,
        minWidth: 110,
        accessor: (client) => client.ClientNumber,
        cell: (client) => <SeoTableTag>{displayValue(client.ClientNumber)}</SeoTableTag>,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (client) => getClientPhone(client),
        cell: (client) => <SeoTableTextCell primary={displayValue(getClientPhone(client))} />,
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (client) => client.EmailAddress,
        cell: (client) => <SeoTableMutedCell>{displayValue(client.EmailAddress)}</SeoTableMutedCell>,
      },
      {
        id: 'clientActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsActive),
        cell: (client) => <SeoTableStatusPill active={Boolean(client.IsActive)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'actions',
        header: '',
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (client) => (
          <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
            <Tooltip label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}>
              <ActionIcon
                aria-label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}
                color={client.IsForRetail ? 'red' : 'green'}
                disabled={!client.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleToggleOnlineShopClient(client)}
              >
                {client.IsForRetail ? <IconX size={18} /> : <IconCheck size={18} />}
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
  ]

  const paymentRegisterColumns: SeoRosterColumn<OnlineShopPaymentRegister>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 128,
        minWidth: 116,
        accessor: (register) => Boolean(register.IsSelected),
        cell: (register) => <SeoTableStatusPill active={Boolean(register.IsSelected)} activeLabel="Активна" inactiveLabel="Не активна" />,
      },
      {
        id: 'accountNumber',
        header: 'Рахунок',
        width: 180,
        minWidth: 150,
        accessor: (register) => register.AccountNumber || register.IBAN,
        cell: (register) => (
          <SeoTablePrimaryCell
            icon={<IconCreditCard size={15} />}
            title={displayValue(register.AccountNumber || register.IBAN)}
          />
        ),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 112,
        minWidth: 92,
        accessor: (register) => getPaymentRegisterCurrency(register),
        cell: (register) => <SeoTableTag tone="accent">{displayValue(getPaymentRegisterCurrency(register))}</SeoTableTag>,
      },
      {
        id: 'name',
        header: 'Назва',
        width: 240,
        minWidth: 190,
        accessor: (register) => register.Name,
        cell: (register) => <SeoTableTextCell primary={displayValue(register.Name)} />,
      },
      {
        id: 'bankName',
        header: 'Банк',
        width: 220,
        minWidth: 180,
        accessor: (register) => register.BankName,
        cell: (register) => <SeoTableMutedCell>{displayValue(register.BankName)}</SeoTableMutedCell>,
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (register) => getOrganizationName(register.Organization),
        cell: (register) => <SeoTableMutedCell>{displayValue(getOrganizationName(register.Organization))}</SeoTableMutedCell>,
      },
      {
        id: 'registerActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (register) => Boolean(register.IsActive),
        cell: (register) => <SeoTableStatusPill active={Boolean(register.IsActive)} activeLabel="Активна" inactiveLabel="Не активна" />,
      },
      {
        id: 'actions',
        header: '',
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (register) => (
          <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Обрати')}>
              <ActionIcon
                aria-label={t('Обрати')}
                color={register.IsSelected ? 'green' : 'gray'}
                disabled={!register.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleSelectPaymentRegister(register)}
              >
                <IconCheck size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
  ]

  const ecommerceStorageColumns = useMemo<SeoRosterColumn<OnlineShopStorage>[]>(
    () => [
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => <SeoTableTag tone="accent">{displayValue(storage.RetailPriority)}</SeoTableTag>,
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 280,
        minWidth: 220,
        accessor: (storage) => storage.Name,
        cell: (storage) => (
          <SeoTablePrimaryCell
            icon={<IconBuildingWarehouse size={15} />}
            title={displayValue(storage.Name)}
          />
        ),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (storage) => getOrganizationName(storage.Organization),
        cell: (storage) => <SeoTableMutedCell>{displayValue(getOrganizationName(storage.Organization))}</SeoTableMutedCell>,
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (storage) => storage.Locale,
        cell: (storage) => <SeoTableLocaleTag>{displayValue(storage.Locale)}</SeoTableLocaleTag>,
      },
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => Boolean(storage.ForEcommerce),
        cell: (storage) => <SeoTableStatusPill active={Boolean(storage.ForEcommerce)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'actions',
        header: '',
        width: 104,
        minWidth: 104,
        maxWidth: 104,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (storage) => (
          <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Змінити пріоритет')}>
              <ActionIcon
                aria-label={t('Змінити пріоритет')}
                color="gray"
                disabled={!storage.Id || isSaving}
                variant="subtle"
                onClick={() => openPriorityEditor(storage)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити зі списку')}>
              <ActionIcon
                aria-label={t('Видалити зі списку')}
                color="red"
                disabled={!storage.NetUid || isSaving}
                variant="subtle"
                onClick={() => requestRemoveStorage(storage)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [isSaving, openPriorityEditor, requestRemoveStorage, t],
  )

  const allStorageColumns: SeoRosterColumn<OnlineShopStorage>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => isStorageActive(storage, ecommerceStorages),
        cell: (storage) => (
          <SeoTableStatusPill
            active={isStorageActive(storage, ecommerceStorages)}
            activeLabel="Активний"
            inactiveLabel="Не активний"
          />
        ),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 280,
        minWidth: 220,
        accessor: (storage) => storage.Name,
        cell: (storage) => (
          <SeoTablePrimaryCell
            icon={<IconBuildingWarehouse size={15} />}
            title={displayValue(storage.Name)}
          />
        ),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (storage) => getOrganizationName(storage.Organization),
        cell: (storage) => <SeoTableMutedCell>{displayValue(getOrganizationName(storage.Organization))}</SeoTableMutedCell>,
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (storage) => storage.Locale,
        cell: (storage) => <SeoTableLocaleTag>{displayValue(storage.Locale)}</SeoTableLocaleTag>,
      },
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => <SeoTableTag tone="accent">{displayValue(storage.RetailPriority)}</SeoTableTag>,
      },
      {
        id: 'actions',
        header: '',
        width: 88,
        minWidth: 88,
        maxWidth: 88,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (storage) => {
          const active = isStorageActive(storage, ecommerceStorages)

          return (
            <SeoTableActionCell onClick={(event) => event.stopPropagation()}>
              <Tooltip label={active ? t('Вже додано') : t('Додати')}>
                <ActionIcon
                  aria-label={active ? t('Вже додано') : t('Додати')}
                  color={active ? 'green' : 'gray'}
                  disabled={active || !storage.NetUid || isSaving}
                  variant="subtle"
                  onClick={() => void handleAddStorage(storage)}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </SeoTableActionCell>
          )
        },
      },
  ]

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setError(null)

      try {
        const nextSettings = await getOnlineShopSeoSettings()

        if (!cancelled) {
          setSettings(nextSettings)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSettings([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити SEO онлайн-магазину'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoading, setSettings, t])

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      setClientsLoading(true)

      try {
        const nextClients = await getOnlineShopClients()

        if (!cancelled) {
          setOnlineShopClients(nextClients)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOnlineShopClients([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інтернет клієнтів'))
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setClientsLoading, setError, setOnlineShopClients, t])

  useEffect(() => {
    let cancelled = false

    async function loadCards() {
      setCardsLoading(true)

      try {
        const nextCards = await getOnlineShopPaymentRegisters()

        if (!cancelled) {
          setPaymentRegisters(nextCards)
        }
      } catch (loadError) {
        if (!cancelled) {
          setPaymentRegisters([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити банківські картки'))
        }
      } finally {
        if (!cancelled) {
          setCardsLoading(false)
        }
      }
    }

    void loadCards()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setCardsLoading, setError, setPaymentRegisters, t])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setStoragesLoading(true)

      try {
        const [nextActiveStorages, nextAllStorages] = await Promise.all([getEcommerceStorages(), getAllOnlineShopStorages()])

        if (!cancelled) {
          setEcommerceStorages(sortStoragesByPriority(nextActiveStorages))
          setAllStorages(markEcommerceStorages(nextAllStorages, nextActiveStorages))
        }
      } catch (loadError) {
        if (!cancelled) {
          setEcommerceStorages([])
          setAllStorages([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setStoragesLoading(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setAllStorages, setEcommerceStorages, setError, setStoragesLoading, t])

  function changePageSearch(value: string) {
    setPageSearchDraft(value)
    setPageSearchValue(value.trim())
  }

  function changeContactSearch(value: string) {
    setContactSearchDraft(value)
    setContactSearchValue(value.trim())
  }

  function changeClientSearch(value: string) {
    setClientSearchDraft(value)
    setClientSearchValue(value.trim())
  }

  function changeCardSearch(value: string) {
    setCardSearchDraft(value)
    setCardSearchValue(value.trim())
  }

  function changeStorageSearch(value: string) {
    setStorageSearchDraft(value)
    setStorageSearchValue(value.trim())
  }

  function changeAllStorageSearch(value: string) {
    setAllStorageSearchDraft(value)
    setAllStorageSearchValue(value.trim())
  }

  function resetPageSearch() {
    setPageSearchDraft('')
    setPageSearchValue('')
  }

  function resetContactSearch() {
    setContactSearchDraft('')
    setContactSearchValue('')
  }

  function resetClientSearch() {
    setClientSearchDraft('')
    setClientSearchValue('')
  }

  function resetCardSearch() {
    setCardSearchDraft('')
    setCardSearchValue('')
  }

  function resetStorageSearch() {
    setStorageSearchDraft('')
    setStorageSearchValue('')
  }

  function resetAllStorageSearch() {
    setAllStorageSearchDraft('')
    setAllStorageSearchValue('')
  }

  function closePageEditor() {
    if (isSaving) {
      return
    }

    setPageEditorOpen(false)
    setSelectedPageRow(null)
    setPageFormValues(EMPTY_PAGE_FORM_VALUES)
    setFormError(null)
  }

  function closeContactEditor() {
    if (isSaving || isImageUploading) {
      return
    }

    setContactEditorOpen(false)
    setEditingContact(null)
    setContactFormValues(EMPTY_CONTACT_FORM_VALUES)
    setFormError(null)
  }

  function closePriorityEditor() {
    if (isSaving) {
      return
    }

    setPriorityStorageTarget(null)
    setPriorityValue('')
    setFormError(null)
  }

  function setPageField<K extends keyof typeof pageFormValues>(key: K, value: (typeof pageFormValues)[K]) {
    setPageFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  function setContactField<K extends keyof SeoContactFormValues>(key: K, value: SeoContactFormValues[K]) {
    setContactFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  async function handleSavePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedPageRow) {
      return
    }

    const validationError = validatePage(pageFormValues)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextSettings = await updateSeoPage({
        ...selectedPageRow.page,
        ...pageFormValues,
        Locale: selectedPageRow.page.Locale || selectedPageRow.locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('SEO сторінки оновлено') })
      closePageEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти SEO сторінки'))
    } finally {
      setSaving(false)
    }
  }

  const openGeneralLocaleEditor = useCallback((entry: SeoLocaleEntry) => {
    setEditingGeneralLocale(entry.locale)
    setFormError(null)
  }, [setEditingGeneralLocale, setFormError])

  function closeGeneralLocaleEditor() {
    setEditingGeneralLocale(null)
    setFormError(null)
  }

  async function handleSaveContactInfo(locale: string, contactInfo: SeoContactInfo | null, values: SeoContactInfoFormValues) {
    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextSettings = await updateSeoContactInfo({
        ...(contactInfo || {}),
        ...values,
        Locale: contactInfo?.Locale || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Контактну інформацію оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти контактну інформацію'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePayment(locale: string, payment: SeoRetailPaymentInfo | null, values: SeoPaymentFormValues) {
    if (!hasPaymentRecord(payment)) {
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextSettings = await updateSeoPaymentInfo({
        ...(payment || {}),
        ...values,
        CultureCode: payment?.CultureCode || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Інформацію про оплату оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти інформацію про оплату'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateContact(contactFormValues)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const payload = {
        ...(editingContact || {}),
        ...contactFormValues,
      }
      const nextSettings = editingContact ? await updateSeoContact(payload) : await createSeoContact(payload)

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: editingContact ? t('Контакт оновлено') : t('Контакт створено') })
      closeContactEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти контакт'))
    } finally {
      setSaving(false)
    }
  }

  async function handleContactImageChange(file: File | null) {
    if (!file) {
      return
    }

    setImageUploading(true)
    setFormError(null)

    try {
      const imageUrl = await uploadSeoContactImage(file)

      if (!imageUrl) {
        throw new Error(t('Сервер не повернув посилання на фото'))
      }

      setContactField('ImgUrl', imageUrl)
      notifications.show({ color: 'green', message: t('Фото контакту завантажено') })
    } catch (uploadError) {
      setFormError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити фото контакту'))
    } finally {
      setImageUploading(false)
    }
  }

  async function handleRemoveContact() {
    if (!removeContactTarget?.NetUid) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextSettings = await removeSeoContact(removeContactTarget.NetUid)

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Контакт видалено') })
      setRemoveContactTarget(null)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити контакт'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleOnlineShopClient(client: OnlineShopClient) {
    if (!client.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextClients = await toggleOnlineShopClient(client.NetUid)

      setOnlineShopClients(nextClients)
      notifications.show({ color: 'green', message: client.IsForRetail ? t('Клієнта вимкнено') : t('Клієнта увімкнено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося змінити статус клієнта'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectPaymentRegister(register: OnlineShopPaymentRegister) {
    if (!register.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextRegisters = await selectOnlineShopPaymentRegister(register.NetUid)

      setPaymentRegisters(nextRegisters)
      notifications.show({ color: 'green', message: t('Банківську картку обрано') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося обрати банківську картку'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStorage(storage: OnlineShopStorage) {
    if (!storage.NetUid || isSaving || isStorageActive(storage, ecommerceStorages)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextStorages = sortStoragesByPriority(await addEcommerceStorage(storage.NetUid))

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      notifications.show({ color: 'green', message: t('Склад додано') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося додати склад'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveStorage() {
    if (!removeStorageTarget?.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextStorages = sortStoragesByPriority(await removeEcommerceStorage(removeStorageTarget.NetUid))

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      setRemoveStorageTarget(null)
      notifications.show({ color: 'green', message: t('Склад видалено зі списку') })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити склад зі списку'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveStoragePriority(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!priorityStorageTarget?.Id || isSaving) {
      return
    }

    const validationError = validateStoragePriority(priorityValue, priorityStorageTarget, ecommerceStorages)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextStorages = sortStoragesByPriority(
        await updateEcommerceStoragePriority(priorityStorageTarget.Id, Number(priorityValue)),
      )

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      setPriorityStorageTarget(null)
      setPriorityValue('')
      notifications.show({ color: 'green', message: t('Пріоритет складу оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити пріоритет складу'))
    } finally {
      setSaving(false)
    }
  }

  return {
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft,
    availableStorages, cardSearchDraft, cards, clientColumns, clientSearchDraft, clients,
    contactColumns, contactFormValues, contactSearchDraft, contacts,
    ecommerceStorageColumns, ecommerceStorages, editingContact, editingGeneralLocale, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    removeStorageTarget, settings, storageSearchDraft, allStorageSearchValue,
    cardSearchValue, clientSearchValue, contactSearchValue, pageSearchValue, storageSearchValue,
    changeAllStorageSearch, changeCardSearch, changeClientSearch, changeContactSearch, changePageSearch,
    changeStorageSearch, closeContactEditor, closeGeneralLocaleEditor, closePageEditor, closePriorityEditor, handleAddStorage, handleContactImageChange,
    handleRemoveContact, handleRemoveStorage, handleSaveContact, handleSaveContactInfo, handleSavePage,
    handleSavePayment, handleSaveStoragePriority, handleSelectPaymentRegister, handleToggleOnlineShopClient,
    openContactEditor, openGeneralLocaleEditor, openPageEditor, reload, resetAllStorageSearch, resetCardSearch, resetClientSearch,
    resetContactSearch, resetPageSearch, resetStorageSearch, setActiveTab, setContactField, setFormError,
    setPageField, setPriorityValue, setRemoveContactTarget, setRemoveStorageTarget,
    setStorageDrawerOpen,
  }
}

export function OnlineShopSeoPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { tab } = useParams<{ tab?: string }>()
  const activeTab = getSeoTabFromSlug(tab)
  const activeTabLabel = SEO_TABS.find((item) => item.value === activeTab)?.label || 'Загальна інформація та оплата'
  const setActiveTab = useCallback(
    (nextTab: SeoTab) => {
      navigate(getSeoTabHref(nextTab))
    },
    [navigate],
  )

  useEffect(() => {
    if (!isSeoTabSlug(tab)) {
      navigate(getSeoTabHref(activeTab), { replace: true })
    }
  }, [activeTab, navigate, tab])

  usePageBreadcrumb(t(activeTabLabel))

  const model = useOnlineShopSeoPageModel(activeTab, setActiveTab)

  return renderOnlineShopSeoPage(model)
}

function renderOnlineShopSeoPage(model: ReturnType<typeof useOnlineShopSeoPageModel>) {
  const {
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft,
    availableStorages, cardSearchDraft, cards, clientColumns, clientSearchDraft, clients,
    contactColumns, contactFormValues, contactSearchDraft, contacts,
    ecommerceStorageColumns, ecommerceStorages, editingContact, editingGeneralLocale, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    removeStorageTarget, settings, storageSearchDraft, closeContactEditor, closeGeneralLocaleEditor, closePageEditor,
    closePriorityEditor, handleAddStorage, handleContactImageChange, handleRemoveContact, handleRemoveStorage,
    handleSaveContact, handleSaveContactInfo, handleSavePage, handleSavePayment, handleSaveStoragePriority,
    handleSelectPaymentRegister, handleToggleOnlineShopClient, changeAllStorageSearch, changeCardSearch,
    changeClientSearch, changeContactSearch, changePageSearch, changeStorageSearch, openContactEditor, openGeneralLocaleEditor, openPageEditor, reload,
    resetAllStorageSearch, resetCardSearch, resetClientSearch, resetContactSearch, resetPageSearch,
    resetStorageSearch, setActiveTab, setContactField, setFormError, setPageField, setPriorityValue,
    setRemoveContactTarget, setRemoveStorageTarget, setStorageDrawerOpen,
  } = model
  const commandSearch = getSeoCommandSearchConfig(activeTab, {
    cardSearchDraft,
    changeCardSearch,
    changeClientSearch,
    changeContactSearch,
    changePageSearch,
    changeStorageSearch,
    clientSearchDraft,
    contactSearchDraft,
    pageSearchDraft,
    resetCardSearch,
    resetClientSearch,
    resetContactSearch,
    resetPageSearch,
    resetStorageSearch,
    storageSearchDraft,
  })
  const headerAction = activeTab === 'contacts'
    ? (
      <Button
        color={CREATE_ACTION_COLOR}
        leftSection={<IconPlus size={14} />}
        size="xs"
        type="button"
        onClick={() => openContactEditor()}
      >
        {t('Новий контакт')}
      </Button>
    )
    : activeTab === 'warehouses'
      ? (
        <Button
          color={CREATE_ACTION_COLOR}
          leftSection={<IconPlus size={14} />}
          size="xs"
          type="button"
          onClick={() => setStorageDrawerOpen(true)}
        >
          {t('Додати склад')}
        </Button>
      )
      : null
  const generalEntries = getOrderedSeoGeneralEntries(settings)
  const generalEditorEntry = editingGeneralLocale
    ? settings.find((entry) => entry.locale === editingGeneralLocale) || null
    : null

  return (
    <Stack className="seo-page" gap="md">
      <PageHeaderActions>
        {headerAction}
      </PageHeaderActions>

      <Box className="seo-page-shell">
        <div className="seo-page-command-bar">
          {commandSearch ? (
            <TextInput
              className="seo-page-search-input"
              leftSection={<IconSearch size={15} />}
              label={t(commandSearch.label)}
              placeholder={t(commandSearch.placeholder)}
              value={commandSearch.value}
              onChange={(event) => commandSearch.onChange(event.currentTarget.value)}
            />
          ) : (
            <div className="seo-page-command-summary">
              <Text className="seo-page-command-summary-description">
                {t('Контактна інформація та дані оплати для інтернет-магазину.')}
              </Text>
              <Text className="seo-page-command-summary-title">{t('Основні налаштування')}</Text>
            </div>
          )}
          <div className="seo-page-toolbar-actions">
            {commandSearch && (
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  disabled={!commandSearch.value}
                  size={34}
                  type="button"
                  variant="light"
                  onClick={commandSearch.onReset}
                >
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={() => reload()}
              >
                <IconRefresh size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="seo-page-workspace">
          <aside className="seo-page-rail">
            <div className="seo-page-rail-header">
              <span>{t('Розділи')}</span>
            </div>
            <div className="seo-page-nav">
              {SEO_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`seo-page-nav-item${activeTab === tab.value ? ' is-active' : ''}`}
                  aria-pressed={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {t(tab.label)}
                </button>
              ))}
            </div>
          </aside>

          <section className="seo-page-panel">
          <Box className="seo-page-panel-body">
            {activeTab === 'pages' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={pageColumns}
                  columnsTemplate="minmax(280px, 1.25fr) minmax(180px, 0.74fr) minmax(140px, 0.64fr) 88px 138px 42px"
                  data={pageRows}
                  emptyText={t('Сторінок не знайдено')}
                  getRowClassName={(row) => (row.locale === 'ru' ? 'is-ru' : undefined)}
                  getRowId={(row, index) => `${row.locale}-${row.page.NetUid || row.page.Id || index}`}
                  isLoading={isLoading}
                  loadingText={t('Завантаження сторінок')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={900}
                  onRowClick={openPageEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'info-payment' && (
              <Box className="seo-general-content" pt="md">
                <div className="seo-matrix">
                  {generalEntries.length ? (
                    <div className="seo-settings-tree">
                      {generalEntries.map((entry, localeIndex) => (
                        <section
                          className={`seo-settings-tree-module${localeIndex > 0 ? ' is-separated' : ''}`}
                          key={entry.locale}
                        >
                          <div className="seo-settings-tree-module-header">
                            <div className="seo-settings-tree-module-title">
                              <Text className="seo-settings-tree-module-name">{entry.locale}</Text>
                            </div>
                            <Tooltip label={t('Редагувати')}>
                              <ActionIcon
                                aria-label={`${t('Редагувати')} ${entry.locale}`}
                                className="seo-settings-tree-action"
                                color="gray"
                                disabled={isSaving}
                                size={26}
                                type="button"
                                variant="subtle"
                                onClick={() => openGeneralLocaleEditor(entry)}
                              >
                                <IconPencil size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </div>

                          <div className="seo-settings-tree-node-list">
                            {SEO_GENERAL_MATRIX_SECTIONS.map((section) => {
                              return (
                                <article className="seo-settings-tree-node" key={`${entry.locale}-${section.group}`}>
                                  <div className="seo-settings-tree-node-row">
                                    <span className="seo-settings-tree-node-icon">
                                      {section.group === 'contact' ? <IconInfoCircle size={15} /> : <IconCreditCard size={15} />}
                                    </span>
                                    <div className="seo-settings-tree-node-title">
                                      <Text className="seo-settings-tree-node-name">{t(section.label)}</Text>
                                    </div>
                                  </div>

                                  <div className="seo-settings-tree-field-list">
                                    {section.fields.map((field) => {
                                      const value = getSeoGeneralMatrixValue(entry, field)
                                      const isMissingRecord = !isSeoGeneralMatrixFieldEditable(entry, field)

                                      return (
                                        <div
                                          className={`seo-settings-tree-field${value ? '' : ' is-empty'}${isMissingRecord ? ' is-disabled' : ''}`}
                                          key={`${entry.locale}-${field.group}-${field.id}`}
                                        >
                                          <span className="seo-settings-tree-connector" aria-hidden />
                                          <span className="seo-settings-tree-field-icon">
                                            {field.group === 'contact' ? <IconInfoCircle size={13} /> : <IconCreditCard size={13} />}
                                          </span>
                                          <div className="seo-settings-tree-field-content">
                                            <div className="seo-settings-tree-field-body">
                                              <Text className="seo-settings-tree-field-name">{t(field.label)}</Text>
                                            </div>
                                            <span className="seo-settings-tree-field-line" aria-hidden />
                                            <span className="seo-settings-tree-field-value">
                                              {isMissingRecord ? t('Запис відсутній') : displayValue(value, t('Не заповнено'))}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="seo-matrix-empty">
                      <Text c="dimmed" size="sm">{t('Даних для редагування не знайдено')}</Text>
                    </div>
                  )}
                </div>
              </Box>
            )}

            {activeTab === 'contacts' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={contactColumns}
                  columnsTemplate="minmax(240px, 1fr) 170px 220px 130px 110px 138px 74px"
                  data={contacts}
                  emptyText={t('Контактів не знайдено')}
                  getRowId={(contact, index) => String(contact.NetUid || contact.Id || index)}
                  isLoading={isLoading}
                  loadingText={t('Завантаження контактів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1080}
                  onRowClick={openContactEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'shop-clients' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={clientColumns}
                  columnsTemplate="118px minmax(250px, 1fr) 118px 170px 220px 118px 54px"
                  data={clients}
                  emptyText={t('Клієнтів не знайдено')}
                  getRowId={(client, index) => String(client.NetUid || client.Id || index)}
                  isLoading={isClientsLoading}
                  loadingText={t('Завантаження клієнтів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1048}
                  onRowClick={(client) => void handleToggleOnlineShopClient(client)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'bank-cards' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={paymentRegisterColumns}
                  columnsTemplate="118px minmax(220px, 0.9fr) 88px minmax(210px, 1fr) minmax(190px, 0.85fr) minmax(240px, 1fr) 118px 54px"
                  data={cards}
                  emptyText={t('Банківських карток не знайдено')}
                  getRowId={(register, index) => String(register.NetUid || register.Id || index)}
                  isLoading={isCardsLoading}
                  loadingText={t('Завантаження карток')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1236}
                  onRowClick={(register) => void handleSelectPaymentRegister(register)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'warehouses' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={ecommerceStorageColumns}
                  columnsTemplate="100px minmax(250px, 1fr) minmax(260px, 1fr) 88px 118px 82px"
                  data={activeStorages}
                  emptyText={t('Активних складів не знайдено')}
                  getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
                  isLoading={isStoragesLoading}
                  loadingText={t('Завантаження складів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={898}
                />
              </Stack>
              </Box>
            )}
          </Box>
          </section>
        </div>
      </Box>

      <AppDrawer
        opened={Boolean(generalEditorEntry)}
        size="standard"
        title={generalEditorEntry ? `${t('Редагування')} ${getLocaleLabel(generalEditorEntry.locale)}` : t('Редагування')}
        onClose={closeGeneralLocaleEditor}
      >
        {generalEditorEntry && (
          <Stack className="seo-general-sheet" gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <div className="seo-general-sheet-context">
              <div className="seo-matrix-editor-context">
                <Badge className="seo-matrix-locale-pill" variant="light">
                  {getLocaleLabel(generalEditorEntry.locale)}
                </Badge>
                <span>
                  <Text className="seo-matrix-editor-eyebrow">{t('Мовна версія')}</Text>
                  <Text className="seo-matrix-editor-title">{generalEditorEntry.locale}</Text>
                </span>
              </div>
              <Button color="gray" size="xs" type="button" variant="light" onClick={closeGeneralLocaleEditor}>
                {t('Закрити')}
              </Button>
            </div>

            <section className="seo-general-sheet-section">
              <div className="seo-general-sheet-section-header">
                <span className="seo-matrix-section-icon">
                  <IconInfoCircle size={15} />
                </span>
                <span>
                  <Text className="seo-matrix-section-title">{t('Загальна інформація')}</Text>
                  <Text className="seo-matrix-section-description">
                    {t('Адреса, телефон, пошта, сайт і Pixel ID для вибраної мови.')}
                  </Text>
                </span>
              </div>
              <ContactInfoForm
                key={`${generalEditorEntry.locale}-${generalEditorEntry.settings.EcommerceContactInfo?.NetUid || 'new'}`}
                contactInfo={generalEditorEntry.settings.EcommerceContactInfo || null}
                isSaving={isSaving}
                locale={generalEditorEntry.locale}
                onSave={handleSaveContactInfo}
              />
            </section>

            <section className="seo-general-sheet-section">
              <div className="seo-general-sheet-section-header">
                <span className="seo-matrix-section-icon">
                  <IconCreditCard size={15} />
                </span>
                <span>
                  <Text className="seo-matrix-section-title">{t('Оплата')}</Text>
                  <Text className="seo-matrix-section-description">
                    {t('Суми, коментарі та повідомлення, які бачить клієнт під час оформлення.')}
                  </Text>
                </span>
              </div>
              <PaymentInfoForm
                key={`${generalEditorEntry.locale}-${generalEditorEntry.settings.RetailPaymentTypeTranslate?.NetUid || 'new'}`}
                isSaving={isSaving}
                locale={generalEditorEntry.locale}
                payment={generalEditorEntry.settings.RetailPaymentTypeTranslate || null}
                onSave={handleSavePayment}
              />
            </section>
          </Stack>
        )}
      </AppDrawer>

      <AppModal centered opened={isPageEditorOpen} size="xl" title={t('Редагування SEO сторінки')} onClose={closePageEditor}>
        <form onSubmit={handleSavePage}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Page name"
                value={pageFormValues.PageName}
                onChange={(event) => setPageField('PageName', event.currentTarget.value)}
              />
              <TextInput
                label="URL"
                value={pageFormValues.Url}
                onChange={(event) => setPageField('Url', event.currentTarget.value)}
              />
            </SimpleGrid>
            <TextInput
              label="Title"
              value={pageFormValues.Title}
              onChange={(event) => setPageField('Title', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="Description"
              minRows={3}
              value={pageFormValues.Description}
              onChange={(event) => setPageField('Description', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="Keywords"
              minRows={3}
              value={pageFormValues.KeyWords}
              onChange={(event) => setPageField('KeyWords', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="LD JSON"
              minRows={6}
              value={pageFormValues.LdJson}
              onChange={(event) => setPageField('LdJson', event.currentTarget.value)}
            />
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={closePageEditor}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={isContactEditorOpen}
        title={editingContact ? t('Редагування контакту') : t('Новий контакт')}
        onClose={closeContactEditor}
      >
        <form onSubmit={handleSaveContact}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label={t('Прізвище')}
                maxLength={80}
                value={contactFormValues.LastName}
                onChange={(event) => setContactField('LastName', event.currentTarget.value)}
              />
              <TextInput
                label={t('Імʼя')}
                maxLength={80}
                value={contactFormValues.FirstName}
                onChange={(event) => setContactField('FirstName', event.currentTarget.value)}
              />
              <TextInput
                label={t('По батькові')}
                maxLength={80}
                value={contactFormValues.MiddleName}
                onChange={(event) => setContactField('MiddleName', event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <Avatar color="violet" name={getSeoContactDisplayName(contactFormValues) || undefined} radius="md" size={72} src={contactFormValues.ImgUrl || undefined}>
                {getContactInitials(contactFormValues)}
              </Avatar>
              <FileInput
                accept="image/*"
                clearable
                disabled={isSaving || isImageUploading}
                label={t('Фото')}
                leftSection={<IconPhoto size={16} />}
                placeholder={t('Обрати файл')}
                style={{ flex: '1 1 auto' }}
                onChange={handleContactImageChange}
              />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label={t('Телефон')}
                maxLength={30}
                value={contactFormValues.Phone}
                onChange={(event) => setContactField('Phone', event.currentTarget.value)}
              />
              <TextInput
                label="E-mail"
                maxLength={150}
                value={contactFormValues.Email}
                onChange={(event) => setContactField('Email', event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving || isImageUploading} type="button" variant="light" onClick={closeContactEditor}>
                {t('Скасувати')}
              </Button>
              <Button
                color="violet"
                disabled={isImageUploading}
                leftSection={<IconDeviceFloppy size={16} />}
                loading={isSaving}
                type="submit"
              >
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(removeContactTarget)}
        title={t('Видалити контакт')}
        onClose={() => setRemoveContactTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити контакт')} <Text span fw={600}>{displayValue(getSeoContactDisplayName(removeContactTarget))}</Text>?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveContactTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={handleRemoveContact}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal centered opened={Boolean(priorityStorageTarget)} title={t('Пріоритет складу')} onClose={closePriorityEditor}>
        <form onSubmit={handleSaveStoragePriority}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <TextInput
              label={displayValue(priorityStorageTarget?.Name, t('Склад'))}
              min={1}
              type="number"
              value={priorityValue}
              onChange={(event) => {
                const nextValue = event.currentTarget.value

                setPriorityValue(nextValue)
                setFormError(priorityStorageTarget ? validateStoragePriority(nextValue, priorityStorageTarget, ecommerceStorages) : null)
              }}
            />
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={closePriorityEditor}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(removeStorageTarget)}
        title={t('Видалити склад зі списку')}
        onClose={() => setRemoveStorageTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити склад')} <Text span fw={600}>{displayValue(removeStorageTarget?.Name)}</Text> {t('зі списку інтернет-магазину?')}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveStorageTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={handleRemoveStorage}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppDrawer
        opened={isStorageDrawerOpen}
        padding="md"
        position="right"
        size="xl"
        title={t('Усі склади')}
        onClose={() => setStorageDrawerOpen(false)}
      >
        <Stack gap="md">
          <SearchToolbar
            placeholder={t('Назва або організація')}
            value={allStorageSearchDraft}
            onChange={changeAllStorageSearch}
            onReset={resetAllStorageSearch}
          />

          <SeoRosterTable
            columns={allStorageColumns}
            columnsTemplate="118px minmax(250px, 1fr) minmax(260px, 1fr) 88px 100px 64px"
            data={availableStorages}
            emptyText={t('Складів не знайдено')}
            getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
            isLoading={isStoragesLoading}
            loadingText={t('Завантаження складів')}
            maxHeight="calc(100vh - 220px)"
            minWidth={880}
            onRowClick={(storage) => void handleAddStorage(storage)}
          />
        </Stack>
      </AppDrawer>
    </Stack>
  )
}

function SeoRosterTable<TData>({
  columns,
  columnsTemplate,
  data,
  emptyText,
  getRowClassName,
  getRowId,
  isLoading,
  loadingText,
  maxHeight,
  minWidth,
  onRowClick,
}: {
  columns: SeoRosterColumn<TData>[]
  columnsTemplate: string
  data: TData[]
  emptyText: ReactNode
  getRowClassName?: (row: TData, index: number) => string | undefined
  getRowId: (row: TData, index: number) => string
  isLoading?: boolean
  loadingText: ReactNode
  maxHeight: string
  minWidth: number
  onRowClick?: (row: TData) => void
}) {
  const tableStyle = {
    '--seo-roster-columns': columnsTemplate,
    '--seo-roster-min-width': `${minWidth}px`,
  } as CSSProperties

  return (
    <div className="seo-roster-table" style={tableStyle}>
      <div className="seo-roster-head">
        {columns.map((column) => (
          <span className={`seo-roster-head-cell is-${column.id}`} key={column.id}>
            {column.header}
          </span>
        ))}
      </div>

      <ScrollArea.Autosize mah={maxHeight} type="auto">
        <div className="seo-roster-body">
          {isLoading ? (
            <div className="seo-roster-empty">{loadingText}</div>
          ) : data.length ? (
            data.map((row, index) => {
              const rowClassName = getRowClassName?.(row, index)
              const rowId = getRowId(row, index)

              return (
                <div className="seo-roster-row-frame" key={rowId}>
                  <div
                    className={[
                      'seo-roster-row',
                      rowClassName,
                      onRowClick ? 'is-clickable' : undefined,
                    ].filter(Boolean).join(' ')}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick
                      ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }
                      : undefined}
                  >
                    {columns.map((column) => (
                      <div className={`seo-roster-cell is-${column.id}`} key={column.id}>
                        {column.cell ? column.cell(row) : displayValue(column.accessor?.(row))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="seo-roster-empty">{emptyText}</div>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  )
}

function SeoTablePrimaryCell({
  avatar,
  icon,
  subtitle,
  title,
}: {
  avatar?: ReactNode
  icon?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="seo-table-primary-cell">
      {avatar || (
        <span className="seo-table-primary-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="seo-table-primary-copy">
        <Text className="seo-table-primary-title">{title}</Text>
        {subtitle ? (
          <Text className="seo-table-primary-subtitle">{subtitle}</Text>
        ) : null}
      </span>
    </div>
  )
}

function SeoTableTextCell({ primary }: { primary: ReactNode }) {
  return (
    <span className="seo-table-text-cell">
      <Text className="seo-table-text-primary">{primary}</Text>
    </span>
  )
}

function SeoTableDateCell({ value }: { value?: Date | string }) {
  const formattedValue = formatDateTime(value)
  const [datePart, timePart] = formattedValue.split(',').map((part) => part.trim())

  return (
    <span className="seo-table-date-cell">
      <Text className="seo-table-date-primary">{displayValue(datePart)}</Text>
      {timePart ? (
        <Text className="seo-table-date-secondary">{timePart}</Text>
      ) : null}
    </span>
  )
}

function SeoTableMutedCell({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'date' | 'default' | 'url'
}) {
  return <span className={`seo-table-muted-cell is-${tone}`}>{children}</span>
}

function SeoTableRoleLikeCell({
  children,
  icon,
  tone = 'default',
}: {
  children: ReactNode
  icon: ReactNode
  tone?: 'date' | 'default' | 'url'
}) {
  return (
    <span className="seo-table-role-like-cell">
      <span className="seo-table-role-like-icon" aria-hidden>
        {icon}
      </span>
      <SeoTableMutedCell tone={tone}>{children}</SeoTableMutedCell>
    </span>
  )
}

function SeoTableTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'accent' | 'locale' | 'neutral' }) {
  return <span className={`seo-table-tag is-${tone}`}>{children}</span>
}

function SeoTableLocaleTag({ children }: { children: ReactNode }) {
  return <SeoTableTag tone="locale">{children}</SeoTableTag>
}

function SeoTableStatusPill({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: TranslationKey
  inactiveLabel: TranslationKey
}) {
  const { t } = useI18n()

  return (
    <span className={`seo-table-status-pill ${active ? 'is-active' : 'is-inactive'}`}>
      {active ? t(activeLabel) : t(inactiveLabel)}
    </span>
  )
}

function SeoTableActionCell({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: MouseEventHandler<HTMLDivElement>
}) {
  return (
    <div className="seo-table-action-cell" onClick={onClick}>
      {children}
    </div>
  )
}

function getOrderedSeoGeneralEntries(entries: SeoLocaleEntry[]) {
  const localeOrder = new Map<string, number>([
    ['uk', 0],
    ['ua', 0],
    ['ru', 1],
  ])

  return [...entries].sort((leftEntry, rightEntry) => {
    const leftLocale = leftEntry.locale.toLowerCase()
    const rightLocale = rightEntry.locale.toLowerCase()
    const leftOrder = localeOrder.get(leftLocale) ?? 10
    const rightOrder = localeOrder.get(rightLocale) ?? 10

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return leftLocale.localeCompare(rightLocale)
  })
}

function getSeoGeneralMatrixValue(entry: SeoLocaleEntry, field: SeoGeneralMatrixField) {
  if (field.group === 'contact') {
    const record = entry.settings.EcommerceContactInfo as Partial<Record<SeoGeneralContactFieldId, string>> | null | undefined

    return record?.[field.id] || ''
  }

  const record = entry.settings.RetailPaymentTypeTranslate as Partial<Record<SeoGeneralPaymentFieldId, string>> | null | undefined

  return record?.[field.id] || ''
}

function isSeoGeneralMatrixFieldEditable(entry: SeoLocaleEntry, field: SeoGeneralMatrixField) {
  return field.group === 'contact' || hasPaymentRecord(entry.settings.RetailPaymentTypeTranslate)
}

function isSeoTabSlug(slug: string | undefined): slug is SeoTab {
  return Boolean(slug && SEO_TAB_VALUES.has(slug as SeoTab))
}

function getSeoTabFromSlug(slug: string | undefined): SeoTab {
  if (slug === 'contact-info' || slug === 'payment') {
    return 'info-payment'
  }

  return isSeoTabSlug(slug) ? slug : DEFAULT_SEO_TAB
}

function getSeoTabHref(tab: SeoTab) {
  return `/online-shop-seo/${tab}`
}

type SeoCommandSearchConfig = {
  label: TranslationKey
  placeholder: TranslationKey
  value: string
  onChange: (value: string) => void
  onReset: () => void
}

type SeoCommandSearchState = {
  cardSearchDraft: string
  changeCardSearch: (value: string) => void
  changeClientSearch: (value: string) => void
  changeContactSearch: (value: string) => void
  changePageSearch: (value: string) => void
  changeStorageSearch: (value: string) => void
  clientSearchDraft: string
  contactSearchDraft: string
  pageSearchDraft: string
  resetCardSearch: () => void
  resetClientSearch: () => void
  resetContactSearch: () => void
  resetPageSearch: () => void
  resetStorageSearch: () => void
  storageSearchDraft: string
}

function getSeoCommandSearchConfig(
  activeTab: SeoTab,
  state: SeoCommandSearchState,
): SeoCommandSearchConfig | null {
  switch (activeTab) {
    case 'pages':
      return {
        label: 'Пошук',
        placeholder: 'Назва, URL або текст',
        value: state.pageSearchDraft,
        onChange: state.changePageSearch,
        onReset: state.resetPageSearch,
      }
    case 'contacts':
      return {
        label: 'Пошук',
        placeholder: 'Імʼя, телефон або e-mail',
        value: state.contactSearchDraft,
        onChange: state.changeContactSearch,
        onReset: state.resetContactSearch,
      }
    case 'shop-clients':
      return {
        label: 'Пошук',
        placeholder: 'Назва, телефон або e-mail',
        value: state.clientSearchDraft,
        onChange: state.changeClientSearch,
        onReset: state.resetClientSearch,
      }
    case 'bank-cards':
      return {
        label: 'Пошук',
        placeholder: 'Рахунок, назва, банк або організація',
        value: state.cardSearchDraft,
        onChange: state.changeCardSearch,
        onReset: state.resetCardSearch,
      }
    case 'warehouses':
      return {
        label: 'Пошук',
        placeholder: 'Назва або організація',
        value: state.storageSearchDraft,
        onChange: state.changeStorageSearch,
        onReset: state.resetStorageSearch,
      }
    case 'info-payment':
      return null
    default:
      return null
  }
}

function filterPageRows(rows: SeoPageRow[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return rows
  }

  return rows.filter((row) =>
    [row.locale, row.page.PageName, row.page.Title, row.page.Url, row.page.Description, row.page.KeyWords]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterContacts(contacts: SeoContact[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return contacts
  }

  return contacts.filter((contact) =>
    [getSeoContactDisplayName(contact), contact.FirstName, contact.LastName, contact.MiddleName, contact.Phone, contact.Email, contact.NetUid]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function shortText(value: string | undefined, maxLength: number) {
  const text = value?.trim()

  if (!text) {
    return '-'
  }

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1)}…`
}

function getContactInitials(contact: SeoContact) {
  const name = getSeoContactDisplayName(contact)

  if (!name) {
    return '?'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getClientInitials(client: OnlineShopClient) {
  const name = getClientDisplayName(client).trim()

  if (!name) {
    return '?'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function filterOnlineShopClients(clients: OnlineShopClient[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return clients
  }

  return clients.filter((client) =>
    [
      getClientDisplayName(client),
      getClientPhone(client),
      client.ClientNumber,
      client.EmailAddress,
      client.NetUid,
      client.IsForRetail ? translate('активний') : translate('не активний'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterPaymentRegisters(registers: OnlineShopPaymentRegister[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return registers
  }

  return registers.filter((register) =>
    [
      register.AccountNumber,
      register.IBAN,
      getPaymentRegisterCurrency(register),
      register.Name,
      register.BankName,
      getOrganizationName(register.Organization),
      register.NetUid,
      register.IsSelected ? translate('активна') : translate('не активна'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterStorages(storages: OnlineShopStorage[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return storages
  }

  return storages.filter((storage) =>
    [
      storage.Name,
      storage.Locale,
      storage.RetailPriority,
      getOrganizationName(storage.Organization),
      storage.NetUid,
      storage.ForEcommerce ? translate('активний') : translate('не активний'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function getClientDisplayName(client: OnlineShopClient) {
  return client.Name || client.FullName || ''
}

function getClientPhone(client: OnlineShopClient) {
  return client.MobileNumber || client.SMSNumber || ''
}

function getPaymentRegisterCurrency(register: OnlineShopPaymentRegister) {
  return (
    register.DefaultPaymentCurrencyRegister?.Currency?.Code ||
    register.PaymentCurrencyRegisters?.[0]?.Currency?.Code ||
    register.DefaultPaymentCurrencyRegister?.Currency?.Name ||
    register.PaymentCurrencyRegisters?.[0]?.Currency?.Name ||
    ''
  )
}

function getOrganizationName(organization?: OnlineShopPaymentRegister['Organization'] | OnlineShopStorage['Organization']) {
  return organization?.FullName || organization?.Name || organization?.Abbreviation || ''
}

function sortStoragesByPriority(storages: OnlineShopStorage[]) {
  return storages.toSorted((firstStorage, secondStorage) => {
    const firstPriority = firstStorage.RetailPriority ?? Number.MAX_SAFE_INTEGER
    const secondPriority = secondStorage.RetailPriority ?? Number.MAX_SAFE_INTEGER

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    return (firstStorage.Name || '').localeCompare(secondStorage.Name || '', 'uk')
  })
}

function markEcommerceStorages(storages: OnlineShopStorage[], activeStorages: OnlineShopStorage[]) {
  const activeStorageKeys = new Set<string>()
  activeStorages.forEach((storage) => {
    const key = getEntityKey(storage)

    if (key) {
      activeStorageKeys.add(key)
    }
  })

  return storages.map((storage) => ({
    ...storage,
    ForEcommerce: activeStorageKeys.has(getEntityKey(storage)),
  }))
}

function isStorageActive(storage: OnlineShopStorage, activeStorages: OnlineShopStorage[]) {
  const storageKey = getEntityKey(storage)

  return Boolean(storageKey && activeStorages.some((activeStorage) => getEntityKey(activeStorage) === storageKey))
}

function validateStoragePriority(value: string, selectedStorage: OnlineShopStorage, storages: OnlineShopStorage[]) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return translate('Вкажіть пріоритет')
  }

  const priority = Number(trimmedValue)

  if (!Number.isInteger(priority) || priority < 1) {
    return translate('Пріоритет має бути цілим додатним числом')
  }

  const hasDuplicatePriority = storages.some((storage) => {
    const sameStorage = getEntityKey(storage) === getEntityKey(selectedStorage)

    return !sameStorage && Number(storage.RetailPriority) === priority
  })

  return hasDuplicatePriority ? translate('Пріоритет складу не може повторюватися') : null
}

function getEntityKey(entity: Pick<OnlineShopStorage | OnlineShopClient | OnlineShopPaymentRegister, 'Id' | 'NetUid'>) {
  return entity.NetUid || (typeof entity.Id === 'number' ? String(entity.Id) : '')
}
