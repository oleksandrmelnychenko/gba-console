import { Select, SimpleGrid, Stack, Switch, TextInput, Textarea } from '@mantine/core'
import type { ComboboxItem, OptionsFilter } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ProductGroup } from '../types'
import { getProductGroupName } from '../utils'

type ProductGroupFormProps = {
  disabled?: boolean
  isLoadingRootGroups?: boolean
  productGroup: ProductGroup
  rootGroups: ProductGroup[]
  selectedRootNetUid: string | null
  onFieldChange: <TKey extends keyof ProductGroup>(key: TKey, value: ProductGroup[TKey]) => void
  onRootGroupChange: (netUid: string | null) => void
}

export function ProductGroupForm({
  disabled = false,
  isLoadingRootGroups = false,
  productGroup,
  rootGroups,
  selectedRootNetUid,
  onFieldChange,
  onRootGroupChange,
}: ProductGroupFormProps) {
  const { t } = useI18n()
  const rootGroupOptions = rootGroups.reduce<Array<{ label: string; value: string }>>((options, rootGroup) => {
    if (rootGroup.NetUid) {
      options.push({
        label: getProductGroupName(rootGroup),
        value: rootGroup.NetUid,
      })
    }

    return options
  }, [])

  const rootGroupSearchText = useMemo(() => {
    const text: Record<string, string> = {}

    rootGroups.forEach((rootGroup) => {
      if (rootGroup.NetUid) {
        text[rootGroup.NetUid] = `${rootGroup.Name || ''} ${rootGroup.FullName || ''} ${rootGroup.Description || ''}`
          .trim()
          .toLowerCase()
      }
    })

    return text
  }, [rootGroups])

  const filterRootGroups: OptionsFilter = ({ options, search }) => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return options
    }

    return (options as ComboboxItem[]).filter((option) =>
      (rootGroupSearchText[option.value] ?? option.label.toLowerCase()).includes(query),
    )
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TextInput
          label={t('Назва')}
          maxLength={100}
          required
          value={productGroup.Name || ''}
          onChange={(event) => onFieldChange('Name', event.currentTarget.value)}
          disabled={disabled}
        />
        <TextInput
          label={t('Повна назва')}
          maxLength={200}
          value={productGroup.FullName || ''}
          onChange={(event) => onFieldChange('FullName', event.currentTarget.value)}
          disabled={disabled}
        />
      </SimpleGrid>

      <Select
        clearable
        data={rootGroupOptions}
        disabled={disabled || isLoadingRootGroups}
        filter={filterRootGroups}
        label={t('Батьківська група')}
        nothingFoundMessage={t('Груп не знайдено')}
        placeholder={isLoadingRootGroups ? t('Завантаження') : undefined}
        searchable
        value={selectedRootNetUid}
        onChange={onRootGroupChange}
      />

      <Textarea
        autosize
        disabled={disabled}
        label={t('Опис')}
        maxLength={1000}
        minRows={3}
        value={productGroup.Description || ''}
        onChange={(event) => onFieldChange('Description', event.currentTarget.value)}
      />

      <Switch
        checked={productGroup.IsActive !== false}
        color="green"
        disabled={disabled}
        label={t('Активна')}
        onChange={(event) => onFieldChange('IsActive', event.currentTarget.checked)}
      />
    </Stack>
  )
}
