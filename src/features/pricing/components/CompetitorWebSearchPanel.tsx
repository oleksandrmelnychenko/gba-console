import { Alert, Anchor, Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core'
import { ExternalLink, Globe, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesUkraineProduct } from '../../sales-ukraine/types'

type CompetitorWebSearchPanelProps = {
  product: SalesUkraineProduct | null
}

type CompetitorSource = {
  key: string
  label: string
  buildUrl: (query: string) => string
}

const COMPETITOR_SOURCES: CompetitorSource[] = [
  { key: 'google-shopping', label: 'Google Shopping', buildUrl: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
  { key: 'prom', label: 'Prom.ua', buildUrl: (q) => `https://prom.ua/search?search_term=${encodeURIComponent(q)}` },
  { key: 'rozetka', label: 'Rozetka', buildUrl: (q) => `https://rozetka.com.ua/ua/search/?text=${encodeURIComponent(q)}` },
  { key: 'google', label: 'Google', buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
]

function buildDefaultQuery(product: SalesUkraineProduct | null): string {
  if (!product) {
    return ''
  }

  const parts = [product.MainOriginalNumber, product.VendorCode, product.Name ?? product.NameUA]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const unique = parts.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  return unique.join(' ')
}

export function CompetitorWebSearchPanel({ product }: CompetitorWebSearchPanelProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  useEffect(() => {
    setQuery(buildDefaultQuery(product))
  }, [product])

  const trimmedQuery = query.trim()
  const disabled = trimmedQuery.length === 0

  return (
    <Stack gap="sm">
      <Group align="center" gap="xs">
        <Globe size={18} />
        <Text className="app-section-title" fw={600} size="sm">
          {t('Ціни конкурентів (веб-пошук)')}
        </Text>
      </Group>

      <TextInput
        label={t('Пошуковий запит')}
        placeholder={t('Оригінальний номер / артикул / назва')}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <Group gap="xs" wrap="wrap">
        {COMPETITOR_SOURCES.map((source) => (
          <Button
            key={source.key}
            component="a"
            disabled={disabled}
            href={disabled ? undefined : source.buildUrl(trimmedQuery)}
            leftSection={<ExternalLink size={14} />}
            rel="noreferrer"
            size="xs"
            target="_blank"
            variant="light"
          >
            {source.label}
          </Button>
        ))}
      </Group>

      <Divider />

      <Alert color="gray" icon={<Info size={16} />} variant="light">
        <Text size="xs">
          {t('Поки що відкриваються зовнішні пошуковики в новій вкладці. Автоматичний збір і зіставлення цін конкурентів через API під’єднаємо пізніше.')}
        </Text>
      </Alert>

      {!disabled && (
        <Text c="dimmed" size="xs">
          {t('Запит')}: <Anchor href={COMPETITOR_SOURCES[0].buildUrl(trimmedQuery)} rel="noreferrer" target="_blank">{trimmedQuery}</Anchor>
        </Text>
      )}
    </Stack>
  )
}
