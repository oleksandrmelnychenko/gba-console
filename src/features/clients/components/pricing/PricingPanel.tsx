import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  FileButton,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconUpload, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../../shared/url/upgradeHttpToHttps'
import {
  getClientResourceCurrencies,
  getClientResourceOrganizations,
  getClientResourcePricings,
} from '../../api/clientLookupsApi'
import { exportAgreementDocument, exportAgreementWarrantyConditions } from '../../api/clientAgreementsApi'
import { uploadClientContract } from '../../api/clientCabinetApi'
import { ClientAgreementsPanel } from './ClientAgreementsPanel'
import { DiscountsTree, type DiscountsTreeDraft } from './DiscountsTree'
import { ManagerPicker } from './ManagerPicker'
import { applyPendingDiscountDraft } from './pendingDiscountDraft'
import { ServicePayersPanel } from './ServicePayersPanel'
import type {
  Agreement,
  Client,
  ClientAgreement,
  ClientContractDocument,
  ClientPrintDocument,
  Currency,
  Organization,
  Pricing,
  ProductGroupDiscount,
  ServicePayer,
} from '../../types'

export type PricingPanelMode = 'edit' | 'new'

export type PricingPanelProps = {
  client: Client
  isProvider: boolean
  mode?: PricingPanelMode
  disabled?: boolean
  onChange: (client: Client) => void
  onAddContractDocuments?: (files: File[]) => void
  onPendingDiscountDraftChange?: (draft: DiscountsTreeDraft | null) => void
  onRemoveContractDocument?: (document: ClientContractDocument) => void
}

const AGREEMENT_DEFAULT_NAME = 'Default'

function getAgreementName(agreement: Agreement, defaultName: string): string {
  return agreement.Name === AGREEMENT_DEFAULT_NAME ? defaultName : agreement.Name || ''
}

function isSameAgreement(left?: Agreement, right?: Agreement): boolean {
  if (!left || !right) {
    return false
  }

  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (typeof left.Id === 'number' && typeof right.Id === 'number' && left.Id > 0 && right.Id > 0) {
    return left.Id === right.Id
  }

  if (typeof left.TempId === 'number' && typeof right.TempId === 'number') {
    return left.TempId === right.TempId
  }

  return left === right
}

function createNetUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0
    const value = character === 'x' ? random : (random & 0x3) | 0x8

    return value.toString(16)
  })
}

function nextTempId(clientAgreements: ClientAgreement[]): number {
  const used = clientAgreements
    .map((clientAgreement) => clientAgreement.Agreement?.TempId)
    .filter((value): value is number => typeof value === 'number')

  return (used.length ? Math.max(...used) : 0) + 1
}

const RETAIL_CLIENT_TYPE_ROLE_ID = 6

export function PricingPanel({
  client,
  isProvider,
  mode = 'edit',
  disabled = false,
  onChange,
  onAddContractDocuments,
  onPendingDiscountDraftChange,
  onRemoveContractDocument,
}: PricingPanelProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [pricings, setPricings] = useState<Pricing[]>([])
  const [isLoadingLookups, setLoadingLookups] = useState(true)
  const [lookupsError, setLookupsError] = useState<string | null>(null)
  const [selectedAgreementNetId, setSelectedAgreementNetId] = useState<string | undefined>(undefined)
  const [exportDocument, setExportDocument] = useState<ClientPrintDocument | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isUploadingDocuments, setUploadingDocuments] = useState(false)
  const pendingDocumentsRef = useRef<File[]>([])
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const discountDraftRef = useRef<DiscountsTreeDraft | null>(null)

  const clientAgreements = useMemo(() => client.ClientAgreements || [], [client.ClientAgreements])
  const isRetailClient = useMemo(
    () => client.ClientInRole?.ClientTypeRole?.Id === RETAIL_CLIENT_TYPE_ROLE_ID,
    [client.ClientInRole],
  )
  const servicePayers = useMemo(() => client.ServicePayers || [], [client.ServicePayers])
  const contractDocuments = useMemo(() => client.ClientContractDocuments || [], [client.ClientContractDocuments])

  useEffect(() => {
    let cancelled = false

    async function loadLookups() {
      setLoadingLookups(true)
      setLookupsError(null)

      try {
        const [loadedOrganizations, loadedCurrencies, loadedPricings] = await Promise.all([
          getClientResourceOrganizations(),
          getClientResourceCurrencies(),
          getClientResourcePricings(),
        ])

        if (!cancelled) {
          setOrganizations(loadedOrganizations as Organization[])
          setCurrencies(loadedCurrencies as Currency[])
          setPricings(loadedPricings as Pricing[])
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrganizations([])
          setCurrencies([])
          setPricings([])
          setLookupsError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
        }
      } finally {
        if (!cancelled) {
          setLoadingLookups(false)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [t])

  const highlightedAgreement = useMemo(
    () => clientAgreements.find((clientAgreement) => clientAgreement.Agreement?.NetUid === selectedAgreementNetId),
    [clientAgreements, selectedAgreementNetId],
  )

  const showDiscountsTree = !isProvider && Boolean(highlightedAgreement?.Agreement?.NetUid)

  const selectedAgreementLabel = highlightedAgreement?.Agreement
    ? `${getAgreementName(highlightedAgreement.Agreement, t('Основний договір'))} (${highlightedAgreement.Agreement.Organization?.Name || ''})`
    : ''

  function applyDiscountsToAgreement(agreementNetId: string, updatedProductGroupDiscounts: ProductGroupDiscount[]) {
    const nextAgreements = clientAgreements.map((clientAgreement) =>
      clientAgreement.Agreement?.NetUid === agreementNetId
        ? { ...clientAgreement, ProductGroupDiscounts: updatedProductGroupDiscounts, __ProductGroupDiscountsChanged: true }
        : clientAgreement,
    )

    onChange({
      ...client,
      ClientAgreements: nextAgreements,
    })
  }

  function canChangeSelectedAgreement(nextAgreementNetId?: string): boolean {
    const discountDraft = discountDraftRef.current

    if (
      !selectedAgreementNetId
      || selectedAgreementNetId === nextAgreementNetId
      || !discountDraft?.isDirty
      || discountDraft.clientAgreementNetId !== selectedAgreementNetId
    ) {
      return true
    }

    const shouldApply = window.confirm(`${t('Застосувати зміни')} ${t('Договір')}: ${selectedAgreementLabel}`)

    if (!shouldApply) {
      return false
    }

    applyDiscountsToAgreement(selectedAgreementNetId, discountDraft.productGroupDiscounts)
    discountDraftRef.current = null
    onPendingDiscountDraftChange?.(null)

    return true
  }

  function handleRowClick(clientAgreement: ClientAgreement) {
    const netId = clientAgreement.Agreement?.NetUid

    const nextAgreementNetId = selectedAgreementNetId === netId ? undefined : netId

    if (!canChangeSelectedAgreement(nextAgreementNetId)) {
      return
    }

    if (!netId) {
      setSelectedAgreementNetId(undefined)
      discountDraftRef.current = null
      onPendingDiscountDraftChange?.(null)
      return
    }

    discountDraftRef.current = null
    onPendingDiscountDraftChange?.(null)
    setSelectedAgreementNetId(nextAgreementNetId)
  }

  function handleSaveAgreement(agreement: Agreement, isEdit: boolean) {
    const clientWithPendingDiscounts = applyPendingDiscountDraft(client, discountDraftRef.current)
    const existing = clientWithPendingDiscounts.ClientAgreements || []
    let savedAgreement = agreement
    let nextAgreements: ClientAgreement[]

    if (isEdit) {
      nextAgreements = existing.map((clientAgreement) =>
        isSameAgreement(clientAgreement.Agreement, agreement)
          ? { ...clientAgreement, Agreement: agreement }
          : clientAgreement,
      )
    } else {
      const generatedNetUid = agreement.NetUid || createNetUid()
      savedAgreement = {
        ...agreement,
        TempId: nextTempId(existing),
        NetUid: generatedNetUid,
      }
      nextAgreements = [
        ...existing,
        {
          NetUid: generatedNetUid,
          Agreement: savedAgreement,
        },
      ]
    }

    if (savedAgreement.IsActive) {
      nextAgreements = nextAgreements.map((clientAgreement) => {
        const current = clientAgreement.Agreement

        if (!current || isSameAgreement(current, savedAgreement)) {
          return clientAgreement
        }

        if (current.WithVATAccounting === savedAgreement.WithVATAccounting && current.IsActive) {
          return { ...clientAgreement, Agreement: { ...current, IsActive: false } }
        }

        return clientAgreement
      })
    }

    onChange({
      ...clientWithPendingDiscounts,
      ClientAgreements: nextAgreements,
    })

    discountDraftRef.current = null
    onPendingDiscountDraftChange?.(null)

    if (savedAgreement.IsActive && savedAgreement.NetUid) {
      setSelectedAgreementNetId(savedAgreement.NetUid)
    }
  }

  function handleDeleteAgreement(agreement: Agreement) {
    const nextAgreements = clientAgreements.filter(
      (clientAgreement) => !isSameAgreement(clientAgreement.Agreement, agreement),
    )

    if (agreement.NetUid && agreement.NetUid === selectedAgreementNetId) {
      setSelectedAgreementNetId(undefined)
      discountDraftRef.current = null
      onPendingDiscountDraftChange?.(null)
    }

    onChange({
      ...client,
      ClientAgreements: nextAgreements,
    })
  }

  async function handleExportAgreementDocument(netId: string) {
    setIsExporting(true)
    setExportDocument(null)

    try {
      const document = await exportAgreementDocument(netId)
      setExportDocument(document)
    } catch {
      setExportDocument(null)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportAgreementWarranty(netId: string) {
    setIsExporting(true)
    setExportDocument(null)

    try {
      const document = await exportAgreementWarrantyConditions(netId)
      setExportDocument(document)
    } catch {
      setExportDocument(null)
    } finally {
      setIsExporting(false)
    }
  }

  function handleServicePayersChange(payers: ServicePayer[]) {
    onChange({
      ...client,
      ServicePayers: payers,
    })
  }

  function handleApplyDiscounts(updatedProductGroupDiscounts: ProductGroupDiscount[]) {
    const agreementNetId = highlightedAgreement?.Agreement?.NetUid

    if (!agreementNetId) {
      return
    }

    applyDiscountsToAgreement(agreementNetId, updatedProductGroupDiscounts)
    discountDraftRef.current = null
    onPendingDiscountDraftChange?.(null)
  }

  const handleDiscountDraftChange = useCallback((draft: DiscountsTreeDraft) => {
    const nextDraft = draft.isDirty ? draft : null

    discountDraftRef.current = nextDraft
    onPendingDiscountDraftChange?.(nextDraft)
  }, [onPendingDiscountDraftChange])

  function handleAddDocuments(files: File[]) {
    if (mode === 'new' && onAddContractDocuments) {
      onAddContractDocuments(files)
      return
    }

    pendingDocumentsRef.current = [...pendingDocumentsRef.current, ...files]
    onChange({
      ...client,
      ClientContractDocuments: [
        ...contractDocuments,
        ...files.map((file) => ({ FileName: file.name, ContentType: file.type })),
      ],
    })
  }

  function handleRemoveDocument(document: ClientContractDocument) {
    if (mode === 'new' && onRemoveContractDocument) {
      onRemoveContractDocument(document)
      return
    }

    if (document.Id && document.Id > 0) {
      onChange({
        ...client,
        ClientContractDocuments: contractDocuments.map((item) =>
          item === document ? { ...item, Deleted: true } : item,
        ),
      })
      return
    }

    pendingDocumentsRef.current = pendingDocumentsRef.current.filter((file) => file.name !== document.FileName)
    onChange({
      ...client,
      ClientContractDocuments: contractDocuments.filter((item) => item !== document),
    })
  }

  async function handleSaveDocuments() {
    if (mode === 'new' || !(contractDocuments || []).length) {
      return
    }

    setUploadingDocuments(true)
    setDocumentsError(null)

    try {
      const updatedClient = await uploadClientContract(client, pendingDocumentsRef.current)

      if (updatedClient) {
        onChange(updatedClient)
      }

      pendingDocumentsRef.current = []
    } catch (uploadError) {
      setDocumentsError(uploadError instanceof Error ? uploadError.message : t('Не вдалося зберегти документи'))
    } finally {
      setUploadingDocuments(false)
    }
  }

  if (isLoadingLookups) {
    return (
      <Group justify="center" py="xl">
        <Loader color="violet" size="sm" />
        <Text c="dimmed" size="sm">
          {t('Завантаження')}
        </Text>
      </Group>
    )
  }

  return (
    <Stack gap="lg">
      {lookupsError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {lookupsError}
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            <ManagerPicker
              client={client}
              disabled={disabled}
              role={isProvider ? 'provider' : 'buyer'}
              onChange={onChange}
            />

            {!isProvider && mode === 'new' && (
              <ServicePayersPanel
                disabled={disabled}
                payers={servicePayers}
                onChange={handleServicePayersChange}
              />
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            <ClientAgreementsPanel
              agreements={clientAgreements}
              currencies={currencies}
              exportDocument={exportDocument}
              isExporting={isExporting}
              isProvider={isProvider}
              isRetailClient={isRetailClient}
              organizations={organizations}
              pricings={pricings}
              promotionalPricings={pricings}
              selectedAgreementNetId={selectedAgreementNetId}
              onDeleteAgreement={handleDeleteAgreement}
              onExportAgreementDocument={handleExportAgreementDocument}
              onExportAgreementWarrantyConditions={handleExportAgreementWarranty}
              onRowClick={handleRowClick}
              onSaveAgreement={handleSaveAgreement}
            />

            {showDiscountsTree && highlightedAgreement?.Agreement?.NetUid && (
              <Card withBorder padding="md" radius="md">
                <DiscountsTree
                  clientAgreementNetId={highlightedAgreement.Agreement.NetUid}
                  disabled={disabled}
                  productGroupDiscounts={highlightedAgreement.ProductGroupDiscounts || []}
                  selectedAgreementName={selectedAgreementLabel}
                  onApplyChanges={handleApplyDiscounts}
                  onDraftChange={handleDiscountDraftChange}
                />
              </Card>
            )}

            {isProvider && (
              <ContractDocumentsSection
                documents={contractDocuments}
                isUploading={isUploadingDocuments}
                showSave={mode === 'edit'}
                disabled={disabled}
                error={documentsError}
                onAdd={handleAddDocuments}
                onRemove={handleRemoveDocument}
                onSave={handleSaveDocuments}
              />
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function ContractDocumentsSection({
  documents,
  isUploading,
  showSave,
  disabled,
  error,
  onAdd,
  onRemove,
  onSave,
}: {
  documents: ClientContractDocument[]
  isUploading: boolean
  showSave: boolean
  disabled: boolean
  error: string | null
  onAdd: (files: File[]) => void
  onRemove: (document: ClientContractDocument) => void
  onSave: () => void
}) {
  const { t } = useI18n()
  const visibleDocuments = documents.filter((document) => !document.Deleted)

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Title order={5}>{t('Документи договору')}</Title>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
            {error}
          </Alert>
        )}

        <FileButton multiple disabled={disabled} onChange={(files) => files.length > 0 && onAdd(files)}>
          {(buttonProps) => (
            <Button
              color="gray"
              disabled={disabled}
              leftSection={<IconUpload size={16} />}
              variant="light"
              {...buttonProps}
            >
              {t('Завантажити документи договору')}
            </Button>
          )}
        </FileButton>

        {visibleDocuments.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Документів не додано')}
          </Text>
        ) : (
          <Stack gap="xs">
            {visibleDocuments.map((document, index) => (
              <Group
                key={document.NetUid || document.Id || `${document.FileName}-${index}`}
                justify="space-between"
                wrap="nowrap"
              >
                {document.Id && document.DocumentUrl ? (
                  <Anchor
                    href={upgradeHttpToHttps(document.DocumentUrl)}
                    rel="noreferrer"
                    size="sm"
                    target="_blank"
                    truncate
                  >
                    {document.FileName || document.GeneratedName}
                  </Anchor>
                ) : (
                  <Text size="sm" truncate>
                    {document.FileName || document.GeneratedName}
                  </Text>
                )}
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={disabled}
                  variant="subtle"
                  onClick={() => onRemove(document)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}

        {showSave && visibleDocuments.length > 0 && (
          <Group justify="flex-end">
            <Button color="violet" disabled={disabled} loading={isUploading} variant="light" onClick={onSave}>
              {t('Зберегти')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}
