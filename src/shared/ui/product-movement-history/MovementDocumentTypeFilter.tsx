import { Button, Checkbox, Group, Popover, Stack, Text, TextInput } from '@mantine/core'
import { ChevronDown, ListFilter, Search } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import './movement-document-type-filter.css'

type Props = {
  options: Array<{ label: string; value: number }>
  value: number[]
  onChange: (value: number[]) => void
}

export function MovementDocumentTypeFilter({ options, value, onChange }: Props) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const [search, setSearch] = useState('')
  const visibleOptions = options.filter((option) => t(option.label).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  function changeOpened(next: boolean) {
    setOpened(next)
    if (!next) setSearch('')
  }

  return (
    <Popover opened={opened} onChange={changeOpened} position="bottom-start" width={360} shadow="md" radius="md" withinPortal trapFocus returnFocus zIndex={4000}>
      <Popover.Target>
        <Button
          className="movement-document-types-trigger"
          variant="default"
          leftSection={<ListFilter size={16} />}
          rightSection={<ChevronDown size={16} />}
          aria-expanded={opened}
          aria-haspopup="dialog"
          data-mantine-stop-propagation={opened || undefined}
          onClick={() => changeOpened(!opened)}
        >
          {t('Типи документів')} <span className="movement-document-types-count">{value.length}</span>
        </Button>
      </Popover.Target>
      <Popover.Dropdown className="movement-document-types-popover" role="dialog" aria-labelledby={undefined} aria-label={t('Типи документів')} data-mantine-stop-propagation="true">
        <Stack gap={10}>
          <Group justify="space-between" gap={8}>
            <Text fw={600} size="sm">{t('Типи документів')}</Text>
            <Text size="xs" c="dark">{value.length} / {options.length}</Text>
          </Group>
          <TextInput
            aria-label={t('Пошук типу документа')}
            placeholder={t('Пошук')}
            leftSection={<Search size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            data-mantine-stop-propagation="true"
            data-autofocus
          />
          <Group gap={8}>
            <Button data-mantine-stop-propagation="true" variant="default" size="compact-xs" onClick={() => onChange(options.map((option) => option.value))}>{t('Усі')}</Button>
            <Button data-mantine-stop-propagation="true" variant="default" size="compact-xs" onClick={() => onChange([])}>{t('Очистити')}</Button>
          </Group>
          <div className="movement-document-types-list">
            {visibleOptions.map((option) => (
              <Checkbox
                key={option.value}
                data-mantine-stop-propagation="true"
                label={t(option.label)}
                checked={value.includes(option.value)}
                onChange={() => onChange(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value])}
                size="sm"
              />
            ))}
            {visibleOptions.length === 0 ? <Text size="sm" py="sm">{t('Нічого не знайдено')}</Text> : null}
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
