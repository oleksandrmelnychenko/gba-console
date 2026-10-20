import { TableChip } from '../../../shared/ui/TableChip'
import { Card, Group, Select, SegmentedControl, Stack, Switch } from '@mantine/core'
import type {
  BasketSupplyDocumentState,
  BasketSupplyDocumentType,
  Sad,
  SadTypeValue,
  TaxFreePackList,
} from '../types'
import { SAD_TYPES } from '../types'

type DocumentSelectOption = {
  label: string
  value: string
}

type DocumentTargetControlsProps = {
  disabled?: boolean
  documentState: BasketSupplyDocumentState
  notSentSads: Sad[]
  notSentTaxFreePackLists: TaxFreePackList[]
  onChange: (nextState: BasketSupplyDocumentState) => void
  t: (key: string) => string
}

export function DocumentTargetControls({
  disabled = false,
  documentState,
  notSentSads,
  notSentTaxFreePackLists,
  onChange,
  t,
}: DocumentTargetControlsProps) {
  const documentTypeOptions: Array<{ label: string; value: BasketSupplyDocumentType }> = [
    { label: t('Tax Free'), value: 'taxFree' },
    { label: t('Експорт'), value: 'sad' },
  ]
  const sadTypeOptions: Array<{ label: string; value: string }> = [
    { label: t('Sad'), value: String(SAD_TYPES.Sad) },
    { label: t('TIR'), value: String(SAD_TYPES.TIR) },
  ]
  const taxFreeOptions = toDocumentSelectOptions(notSentTaxFreePackLists, t)
  const sadOptions = toDocumentSelectOptions(notSentSads, t)
  const canSelectExisting =
    documentState.documentType === 'taxFree' ? taxFreeOptions.length > 0 : sadOptions.length > 0

  function patchDocumentState(patch: Partial<BasketSupplyDocumentState>) {
    onChange({
      ...documentState,
      ...patch,
    })
  }

  return (
    <Card className="app-section-card" withBorder padding={12}>
      <Stack gap={10}>
        <Group align="center" gap={10} wrap="wrap">
          <SegmentedControl
            data={documentTypeOptions}
            disabled={disabled}
            value={documentState.documentType}
            onChange={(value) => patchDocumentState({ documentType: value as BasketSupplyDocumentType })}
          />
          <Switch
            checked={documentState.isSelectExistingDocument && canSelectExisting}
            disabled={disabled || !canSelectExisting}
            label={t('Вибрати існуючий')}
            onChange={(event) => patchDocumentState({ isSelectExistingDocument: event.currentTarget.checked })}
          />
        </Group>

        {documentState.documentType === 'taxFree' && documentState.isSelectExistingDocument && (
          <Select
            clearable
            data={taxFreeOptions}
            renderOption={({ option }) => <TableChip tone="document" value={option.label} />}
            disabled={disabled}
            label={t('Упаковки (не проведені)')}
            placeholder={t('Оберіть документ')}
            value={documentState.existingTaxFreeNetUid || null}
            onChange={(value) => patchDocumentState({ existingTaxFreeNetUid: value || '' })}
          />
        )}

        {documentState.documentType === 'sad' && (
          <Group align="end" gap="sm" grow>
            {documentState.isSelectExistingDocument ? (
              <Select
                clearable
                data={sadOptions}
                renderOption={({ option }) => <TableChip tone="document" value={option.label} />}
                disabled={disabled}
                label={t('Експорти (не проведені)')}
                placeholder={t('Оберіть документ')}
                value={documentState.existingSadNetUid || null}
                onChange={(value) => patchDocumentState({ existingSadNetUid: value || '' })}
              />
            ) : (
              <Select
                data={sadTypeOptions}
                disabled={disabled}
                label={t('Тип')}
                value={String(documentState.sadType)}
                onChange={(value) => patchDocumentState({ sadType: Number(value || SAD_TYPES.Sad) as SadTypeValue })}
              />
            )}
          </Group>
        )}
      </Stack>
    </Card>
  )
}

function toDocumentSelectOptions<TDocument extends { Id?: number; NetUid?: string; Number?: string }>(
  documents: TDocument[],
  t: (key: string) => string,
) {
  return documents.reduce<DocumentSelectOption[]>((options, document) => {
    const value = document.NetUid || String(document.Id || '')

    if (!value) {
      return options
    }

    options.push({
      label: document.Number || document.NetUid || t('Без номера'),
      value,
    })

    return options
  }, [])
}
