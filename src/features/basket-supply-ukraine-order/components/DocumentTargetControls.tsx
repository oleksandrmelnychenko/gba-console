import { Group, Select, SegmentedControl, Stack, Switch } from '@mantine/core'
import type {
  BasketSupplyDocumentState,
  BasketSupplyDocumentType,
  Sad,
  SadTypeValue,
  TaxFreePackList,
} from '../types'
import { SAD_TYPES } from '../types'

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
    { label: t('TaxFree'), value: 'taxFree' },
    { label: t('Sad'), value: 'sad' },
  ]
  const sadTypeOptions: Array<{ label: string; value: string }> = [
    { label: t('SadTypesSad'), value: String(SAD_TYPES.Sad) },
    { label: t('SadTypesTIR'), value: String(SAD_TYPES.TIR) },
  ]
  const taxFreeOptions = notSentTaxFreePackLists.map((packList) => ({
    label: packList.Number || packList.NetUid || t('Без номера'),
    value: packList.NetUid || String(packList.Id || ''),
  })).filter((option) => option.value)
  const sadOptions = notSentSads.map((sad) => ({
    label: sad.Number || sad.NetUid || t('Без номера'),
    value: sad.NetUid || String(sad.Id || ''),
  })).filter((option) => option.value)
  const canSelectExisting =
    documentState.documentType === 'taxFree' ? taxFreeOptions.length > 0 : sadOptions.length > 0

  function patchDocumentState(patch: Partial<BasketSupplyDocumentState>) {
    onChange({
      ...documentState,
      ...patch,
    })
  }

  return (
    <Stack gap="sm">
      <Group align="end" gap="sm" wrap="wrap">
        <SegmentedControl
          data={documentTypeOptions}
          disabled={disabled}
          value={documentState.documentType}
          onChange={(value) => patchDocumentState({ documentType: value as BasketSupplyDocumentType })}
        />
        <Switch
          checked={documentState.isSelectExistingDocument && canSelectExisting}
          disabled={disabled || !canSelectExisting}
          label={t('SelectExisting')}
          onChange={(event) => patchDocumentState({ isSelectExistingDocument: event.currentTarget.checked })}
        />
      </Group>

      {documentState.documentType === 'taxFree' && documentState.isSelectExistingDocument && (
        <Select
          clearable
          data={taxFreeOptions}
          disabled={disabled}
          label={t('NotSentPackings')}
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
              disabled={disabled}
              label={t('NotSentSads')}
              placeholder={t('Оберіть документ')}
              value={documentState.existingSadNetUid || null}
              onChange={(value) => patchDocumentState({ existingSadNetUid: value || '' })}
            />
          ) : (
            <Select
              data={sadTypeOptions}
              disabled={disabled}
              label={t('Type')}
              value={String(documentState.sadType)}
              onChange={(value) => patchDocumentState({ sadType: Number(value || SAD_TYPES.Sad) as SadTypeValue })}
            />
          )}
        </Group>
      )}
    </Stack>
  )
}
