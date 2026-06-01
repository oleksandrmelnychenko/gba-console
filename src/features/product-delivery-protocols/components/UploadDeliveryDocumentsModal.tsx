import {
  ActionIcon,
  Anchor,
  Button,
  Divider,
  FileButton,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconArrowBackUp, IconFileTypePdf, IconTrash, IconUpload } from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { SupplyOrganization } from '../detailTypes'
import type { DeliveryDocumentDraft } from '../specificationTypes'

type UploadDeliveryDocumentsModalProps = {
  dateCustomDeclaration: string
  existingDocuments: DeliveryDocumentDraft[]
  isSaving: boolean
  newDocuments: DeliveryDocumentDraft[]
  numberCustomDeclaration: string
  opened: boolean
  selectedSupplyOrganizationAgreementNetId?: string | null
  selectedSupplyOrganizationNetId?: string | null
  supplyOrganizations?: SupplyOrganization[]
  onAddFiles: (files: File[]) => void
  onChangeSupplyOrganization?: (netUid: string | null) => void
  onChangeSupplyOrganizationAgreement?: (netUid: string | null) => void
  onChangeDateCustomDeclaration: (value: string) => void
  onChangeNumberCustomDeclaration: (value: string) => void
  onClose: () => void
  onRemoveExistingDocument: (document: DeliveryDocumentDraft) => void
  onRemoveNewDocument: (document: DeliveryDocumentDraft) => void
  onSave: () => void
}

const EMPTY_SUPPLY_ORGANIZATIONS: SupplyOrganization[] = []

export function UploadDeliveryDocumentsModal({
  dateCustomDeclaration,
  existingDocuments,
  isSaving,
  newDocuments,
  numberCustomDeclaration,
  opened,
  selectedSupplyOrganizationAgreementNetId,
  selectedSupplyOrganizationNetId,
  supplyOrganizations = EMPTY_SUPPLY_ORGANIZATIONS,
  onAddFiles,
  onChangeSupplyOrganization,
  onChangeSupplyOrganizationAgreement,
  onChangeDateCustomDeclaration,
  onChangeNumberCustomDeclaration,
  onClose,
  onRemoveExistingDocument,
  onRemoveNewDocument,
  onSave,
}: UploadDeliveryDocumentsModalProps) {
  const { t } = useI18n()
  const selectedSupplyOrganization = supplyOrganizations.find(
    (organization) => organization.NetUid === selectedSupplyOrganizationNetId,
  )
  const organizationOptions = supplyOrganizations.reduce<Array<{ label: string; value: string }>>(
    (options, organization) => {
      if (organization.NetUid && organization.Name) {
        options.push({ label: organization.Name, value: organization.NetUid })
      }

      return options
    },
    [],
  )
  const agreementOptions = (selectedSupplyOrganization?.SupplyOrganizationAgreements || []).reduce<
    Array<{ label: string; value: string }>
  >((options, agreement) => {
    if (agreement.NetUid) {
      options.push({
        label: `${agreement.Name || agreement.Number || ''}${agreement.Currency?.Code ? ` (${agreement.Currency.Code})` : ''}`,
        value: agreement.NetUid,
      })
    }

    return options
  }, [])
  const canSelectSupplier = Boolean(onChangeSupplyOrganization && onChangeSupplyOrganizationAgreement)

  return (
    <AppModal centered opened={opened} size="lg" title={t('Завантаження документів доставки')} onClose={onClose}>
      <Stack gap="md">
        {canSelectSupplier && (
          <Group grow align="flex-end">
            <Select
              clearable
              data={organizationOptions}
              disabled={isSaving}
              label={t('Постачальник послуг')}
              searchable
              value={selectedSupplyOrganizationNetId || null}
              onChange={(value) => {
                onChangeSupplyOrganization?.(value)
              }}
            />
            <Select
              clearable
              data={agreementOptions}
              disabled={isSaving || !selectedSupplyOrganization}
              label={t('Договір')}
              searchable
              value={selectedSupplyOrganizationAgreementNetId || null}
              onChange={(value) => {
                onChangeSupplyOrganizationAgreement?.(value)
              }}
            />
          </Group>
        )}

        <TextInput
          disabled={isSaving}
          label={t('Номер митної декларації')}
          maxLength={20}
          value={numberCustomDeclaration}
          onChange={(event) => onChangeNumberCustomDeclaration(event.currentTarget.value)}
        />
        <TextInput
          disabled={isSaving}
          label={t('Дата митної декларації')}
          type="date"
          value={dateCustomDeclaration}
          onChange={(event) => onChangeDateCustomDeclaration(event.currentTarget.value)}
        />

        {newDocuments.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {t('Нові документи доставки')}
            </Text>
            {newDocuments.map((document) => (
              <Group key={document.id} justify="space-between" wrap="nowrap">
                <Text size="sm" lineClamp={1}>
                  {document.fileName}
                </Text>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon color="red" variant="subtle" onClick={() => onRemoveNewDocument(document)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}

        {existingDocuments.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {t('Завантаженні документи доставки')}
            </Text>
            {existingDocuments.map((document) => (
              <Group key={document.id} justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  {document.documentUrl ? (
                    <Anchor href={document.documentUrl} target="_blank" rel="noreferrer">
                      <Group gap={4} wrap="nowrap">
                        {document.contentType === 'xls' || document.contentType === 'xlsx' ? (
                          <ExcelIcon size={18} />
                        ) : (
                          <IconFileTypePdf size={18} />
                        )}
                        <Text size="sm" lineClamp={1} td={document.deleted ? 'line-through' : undefined}>
                          {document.fileName}
                        </Text>
                      </Group>
                    </Anchor>
                  ) : (
                    <Text size="sm" lineClamp={1} td={document.deleted ? 'line-through' : undefined}>
                      {document.fileName}
                    </Text>
                  )}
                </Group>
                <Tooltip label={document.deleted ? t('Відновити') : t('Видалити')}>
                  <ActionIcon
                    color={document.deleted ? 'gray' : 'red'}
                    variant="subtle"
                    onClick={() => onRemoveExistingDocument(document)}
                  >
                    {document.deleted ? <IconArrowBackUp size={16} /> : <IconTrash size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}

        <Divider />

        <Group justify="flex-end">
          <FileButton multiple accept=".xls,.xlsx,.pdf" onChange={onAddFiles}>
            {(props) => (
              <Button disabled={isSaving} leftSection={<IconUpload size={16} />} variant="light" {...props}>
                {t('Завантажити')}
              </Button>
            )}
          </FileButton>
          <Button loading={isSaving} onClick={onSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
