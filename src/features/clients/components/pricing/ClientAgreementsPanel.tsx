import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconFileTypePdf,
  IconHelpCircle,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../../shared/ui/ExcelIcon'
import { useMemo, useReducer } from 'react'
import { AppModal } from '../../../../shared/ui/AppModal'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../../auth/useAuth'
import { AgreementForm } from './AgreementForm'
import { organizationHasVat } from './organizationVat'
import { PRICING_NAME_BULK_TWO, PRICING_NAME_BULK_TWO_VAT } from './pricingNames'
import './client-agreements.css'
import type {
  Agreement,
  ClientAgreement,
  ClientPrintDocument,
  Currency,
  Organization,
  Pricing,
} from '../../types'

const EDIT_AGREEMENT_PERMISSION = 'Clients_Edit_Contract_Pricing_EditBtn_PKEY'
const AGREEMENT_DEFAULT_NAME = 'Default'

export type ClientAgreementsPanelProps = {
  agreements: ClientAgreement[]
  isProvider: boolean
  organizations: Organization[]
  currencies: Currency[]
  pricings: Pricing[]
  promotionalPricings: Pricing[]
  isRetailClient?: boolean
  isLoading?: boolean
  isSaving?: boolean
  isDeleting?: boolean
  error?: string | null
  selectedAgreementNetId?: string
  exportDocument?: ClientPrintDocument | null
  isExporting?: boolean
  onRowClick?: (clientAgreement: ClientAgreement) => void
  onSaveAgreement: (agreement: Agreement, isEdit: boolean) => void
  onDeleteAgreement: (agreement: Agreement) => void
  onExportAgreementDocument?: (netId: string) => void
  onExportAgreementWarrantyConditions?: (netId: string) => void
}

type AgreementsPanelState = {
  downloadModalOpened: boolean
  formDraft: Agreement | null
  formError: string | null
  formIsEdit: boolean
  formOpened: boolean
}

type AgreementsPanelAction =
  | { type: 'closeDownload' }
  | { type: 'closeForm' }
  | { type: 'openCreate'; draft: Agreement }
  | { type: 'openDownload' }
  | { type: 'openEdit'; agreement: Agreement }
  | { type: 'patchDraft'; patch: Partial<Agreement> }
  | { type: 'setFormError'; error: string | null }

const initialAgreementsPanelState: AgreementsPanelState = {
  downloadModalOpened: false,
  formDraft: null,
  formError: null,
  formIsEdit: false,
  formOpened: false,
}

function agreementsPanelReducer(state: AgreementsPanelState, action: AgreementsPanelAction): AgreementsPanelState {
  switch (action.type) {
    case 'closeDownload':
      return { ...state, downloadModalOpened: false }
    case 'closeForm':
      return { ...state, formOpened: false }
    case 'openCreate':
      return {
        ...state,
        formDraft: action.draft,
        formError: null,
        formIsEdit: false,
        formOpened: true,
      }
    case 'openDownload':
      return { ...state, downloadModalOpened: true }
    case 'openEdit':
      return {
        ...state,
        formDraft: { ...action.agreement },
        formError: null,
        formIsEdit: true,
        formOpened: true,
      }
    case 'patchDraft':
      return {
        ...state,
        formDraft: state.formDraft ? { ...state.formDraft, ...action.patch } : state.formDraft,
        formError: null,
      }
    case 'setFormError':
      return { ...state, formError: action.error }
  }
}

export function ClientAgreementsPanel({
  agreements,
  isProvider,
  organizations,
  currencies,
  pricings,
  promotionalPricings,
  isRetailClient = false,
  isLoading = false,
  isSaving = false,
  isDeleting = false,
  error = null,
  selectedAgreementNetId,
  exportDocument,
  isExporting = false,
  onRowClick,
  onSaveAgreement,
  onDeleteAgreement,
  onExportAgreementDocument,
  onExportAgreementWarrantyConditions,
}: ClientAgreementsPanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission(EDIT_AGREEMENT_PERMISSION)

  const [state, dispatch] = useReducer(agreementsPanelReducer, initialAgreementsPanelState)
  const { downloadModalOpened, formDraft, formError, formIsEdit, formOpened } = state

  const isVatAccountingHidden = useMemo(
    () => !(formDraft?.IsAccounting),
    [formDraft],
  )

  function openCreate() {
    dispatch({
      draft: createAgreementDraft(isProvider, currencies, organizations, pricings, t(AGREEMENT_DEFAULT_NAME)),
      type: 'openCreate',
    })
  }

  function openEdit(agreement: Agreement) {
    dispatch({ agreement, type: 'openEdit' })
  }

  function patchDraft(patch: Partial<Agreement>) {
    dispatch({ patch, type: 'patchDraft' })
  }

  function handleSave() {
    if (!formDraft) {
      return
    }

    if (!formDraft.Name || !formDraft.Name.trim()) {
      dispatch({ error: t('Вкажіть найменування'), type: 'setFormError' })
      return
    }

    if (isProvider && !formDraft.ProviderPricing?.Name) {
      dispatch({ error: t('Створіть тип цін'), type: 'setFormError' })
      return
    }

    if (!isProvider && !formDraft.Pricing?.Id) {
      dispatch({ error: `${t('Не обрано')} - ${t('Тип ціни')}`, type: 'setFormError' })
      return
    }

    onSaveAgreement(formDraft, formIsEdit)
    dispatch({ type: 'closeForm' })
  }

  function handleDelete() {
    if (!formDraft) {
      return
    }

    onDeleteAgreement(formDraft)
    dispatch({ type: 'closeForm' })
  }

  function handlePrint(netId: string) {
    onExportAgreementDocument?.(netId)
    dispatch({ type: 'openDownload' })
  }

  function handleWarranty(netId: string) {
    onExportAgreementWarrantyConditions?.(netId)
    dispatch({ type: 'openDownload' })
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{t('Договори')}</Text>
        {canEdit && (
          <Button
            color={CREATE_ACTION_COLOR}
            leftSection={<IconPlus size={16} />}
            size="xs"
            variant="light"
            onClick={openCreate}
          >
            {t('Додати договір')}
          </Button>
        )}
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        </Group>
      ) : agreements.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed" size="sm">
            {t('Договорів не додано')}
          </Text>
        </Card>
      ) : (
        <Stack gap="xs">
          {agreements.map((clientAgreement, index) => {
            const agreement = clientAgreement.Agreement

            if (!agreement) {
              return null
            }

            const key = String(agreement.NetUid || agreement.Id || clientAgreement.NetUid || index)
            const isHighlighted = Boolean(
              selectedAgreementNetId && agreement.NetUid === selectedAgreementNetId,
            )

            return isProvider ? (
              <ProviderAgreementItem
                key={key}
                agreement={agreement}
                canEdit={canEdit}
                isHighlighted={isHighlighted}
                onClick={() => onRowClick?.(clientAgreement)}
                onEdit={() => openEdit(agreement)}
              />
            ) : (
              <BuyerAgreementItem
                key={key}
                agreement={agreement}
                canEdit={canEdit}
                canExport={Boolean(agreement.NetUid) && (agreement.Id || 0) > 0}
                isHighlighted={isHighlighted}
                originalClientName={clientAgreement.OriginalClientName}
                onClick={() => onRowClick?.(clientAgreement)}
                onEdit={() => openEdit(agreement)}
                onPrint={() => agreement.NetUid && handlePrint(agreement.NetUid)}
                onWarranty={() => agreement.NetUid && handleWarranty(agreement.NetUid)}
              />
            )
          })}
        </Stack>
      )}

      <AppModal
        centered
        opened={formOpened}
        size="lg"
        title={formIsEdit ? t('Редагування договору') : t('Новий договір')}
        onClose={() => dispatch({ type: 'closeForm' })}
      >
        {formDraft && (
          <Stack gap="md">
            <AgreementForm
              agreement={formDraft}
              currencies={currencies}
              errors={formError ? { name: !formDraft.Name?.trim() ? '*' : undefined } : undefined}
              isEdit={formIsEdit}
              isProvider={isProvider}
              isRetailClient={isRetailClient}
              isVatAccountingHidden={isVatAccountingHidden}
              organizations={organizations}
              pricings={pricings}
              promotionalPricings={promotionalPricings}
              onChange={patchDraft}
            />

            {formError && (
              <Text c="red" size="sm">
                {formError}
              </Text>
            )}

            <Group justify="space-between">
              <div>
                {formIsEdit && (
                  <Button
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    loading={isDeleting}
                    variant="light"
                    onClick={handleDelete}
                  >
                    {t('Видалити')}
                  </Button>
                )}
              </div>
              <Group justify="flex-end">
                <Button color="gray" variant="subtle" onClick={() => dispatch({ type: 'closeForm' })}>
                  {t('Скасувати')}
                </Button>
                <Button
                  color={CREATE_ACTION_COLOR}
                  leftSection={<IconCheck size={16} />}
                  loading={isSaving}
                  onClick={handleSave}
                >
                  {t('Зберегти')}
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </AppModal>

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Друк договору')}
        onClose={() => dispatch({ type: 'closeDownload' })}
      >
        <Stack gap="sm">
          {isExporting ? (
            <Group justify="center" py="md">
              <Loader color="violet" size="sm" />
            </Group>
          ) : exportDocument?.DocumentURL || exportDocument?.PdfDocumentURL ? (
            <>
              {exportDocument.DocumentURL && (
                <Anchor
                  className="document-link"
                  href={upgradeHttpToHttps(exportDocument.DocumentURL)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {exportDocument.PdfDocumentURL && (
                <Anchor
                  className="document-link"
                  href={upgradeHttpToHttps(exportDocument.PdfDocumentURL)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="document-link-badge document-link-badge-pdf">
                    <IconFileTypePdf size={22} stroke={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
            </>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Документ недоступний для завантаження')}
            </Text>
          )}
        </Stack>
      </AppModal>
    </Stack>
  )
}

function BuyerAgreementItem({
  agreement,
  canEdit,
  canExport,
  isHighlighted,
  originalClientName,
  onClick,
  onEdit,
  onPrint,
  onWarranty,
}: {
  agreement: Agreement
  canEdit: boolean
  canExport: boolean
  isHighlighted: boolean
  originalClientName?: string
  onClick: () => void
  onEdit: () => void
  onPrint: () => void
  onWarranty: () => void
}) {
  const { t } = useI18n()
  const agreementName = agreement.Name === AGREEMENT_DEFAULT_NAME ? t('Основний договір') : agreement.Name

  return (
    <Card
      className={`agreement-item${isHighlighted || agreement.IsActive ? ' is-selected' : ''}`}
      padding="sm"
      radius="md"
      onClick={onClick}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={6} align="center" wrap="nowrap">
            <Text fw={600} size="sm" truncate>
              {agreementName}
            </Text>
            {agreement.IsActive && (
              <Badge color="green" size="xs" variant="light">
                {t('Активний')}
              </Badge>
            )}
            {originalClientName && (
              <Tooltip label={originalClientName} position="top">
                <Group gap={2} align="center" wrap="nowrap">
                  <IconHelpCircle size={12} />
                  <Text c="dimmed" size="xs" truncate>
                    {originalClientName}
                  </Text>
                </Group>
              </Tooltip>
            )}
          </Group>
          <Text size="xs" truncate>
            {[agreement.Pricing?.Name, agreement.Organization?.Name].filter(Boolean).join(' · ')}
          </Text>
        </Stack>

        <Group gap="xs" align="center" wrap="nowrap">
          {canExport && (
            <>
              <Tooltip label={t('Друк договору')} position="top">
                <ActionIcon
                  aria-label={t('Друк договору')}
                  color="gray"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onPrint()
                  }}
                >
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Гарантійні умови')} position="top">
                <ActionIcon
                  aria-label={t('Гарантійні умови')}
                  color="gray"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onWarranty()
                  }}
                >
                  <IconShieldCheck size={18} />
                </ActionIcon>
              </Tooltip>
            </>
          )}

          {agreement.Currency?.Name && (
            <Badge color="gray" variant="light">
              {agreement.Currency.Name}
            </Badge>
          )}

          <Group gap={4} align="center">
            <Text size="sm">{agreement.AmountDebt ?? 0}</Text>
            <Text c="dimmed" size="xs">
              /
            </Text>
            <Text size="sm">{agreement.NumberDaysDebt ?? 0}</Text>
            <Text c="dimmed" size="xs">
              {t('днів')}
            </Text>
          </Group>

          {canEdit && (
            <ActionIcon
              aria-label={t('Редагувати')}
              color="gray"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <IconPencil size={18} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Card>
  )
}

function ProviderAgreementItem({
  agreement,
  canEdit,
  isHighlighted,
  onClick,
  onEdit,
}: {
  agreement: Agreement
  canEdit: boolean
  isHighlighted: boolean
  onClick: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()

  return (
    <Card
      className={`agreement-item${isHighlighted || agreement.IsActive ? ' is-selected' : ''}`}
      padding="sm"
      radius="md"
      onClick={onClick}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={6} align="center" wrap="nowrap">
            <Text fw={600} size="sm" truncate>
              {agreement.Name}
            </Text>
            {agreement.IsActive && (
              <Badge color="green" size="xs" variant="light">
                {t('Активний')}
              </Badge>
            )}
          </Group>
          <Text size="xs" truncate>
            {[agreement.ProviderPricing?.Name, agreement.Organization?.Name].filter(Boolean).join(' · ')}
          </Text>
        </Stack>

        <Group gap="xs" align="center" wrap="nowrap">
          {agreement.Currency?.Name && (
            <Badge color="gray" variant="light">
              {agreement.Currency.Name}
            </Badge>
          )}
          {agreement.TermsOfPayment && (
            <Text c="dimmed" size="xs">
              {t('Умова')}
            </Text>
          )}
          {agreement.DeferredPayment && (
            <Text c="dimmed" size="xs">
              {t('Термін')}
            </Text>
          )}
          {canEdit && (
            <ActionIcon
              aria-label={t('Редагувати')}
              color="gray"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <IconPencil size={18} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Card>
  )
}

function createAgreementDraft(
  isProvider: boolean,
  currencies: Currency[],
  organizations: Organization[],
  pricings: Pricing[],
  defaultName: string,
): Agreement {
  const now = new Date()
  const nextYear = new Date(new Date().setFullYear(now.getFullYear() + 1))

  const draft: Agreement = {
    Id: 0,
    IsActive: true,
    Name: defaultName,
    AmountDebt: 0,
    NumberDaysDebt: 0,
    PrePaymentPercentages: 0,
    IsPrePaymentFull: true,
    FromDate: now,
    ToDate: nextYear,
    Organization: organizations[0],
    Currency: currencies[0],
  }

  if (isProvider) {
    draft.DeferredPayment = ''
    draft.IsPayForDelivery = false
    draft.ProviderPricing = undefined
  } else {
    const hasVat = organizationHasVat(organizations[0])
    const pricingName = hasVat ? PRICING_NAME_BULK_TWO_VAT : PRICING_NAME_BULK_TWO
    const defaultPricing = pricings.find((pricing) => pricing.Name === pricingName) || pricings[0]
    draft.Pricing = defaultPricing
    draft.PromotionalPricing = defaultPricing
    draft.IsManagementAccounting = !hasVat
    draft.IsAccounting = hasVat
    draft.WithVATAccounting = hasVat
    draft.ForReSale = false
    draft.WithAgreementLine = true
  }

  return draft
}
