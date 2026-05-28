import {
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconBuilding, IconX } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ServiceOrganization } from '../types'

type OrganisationSearchControlProps = {
  isLoading: boolean
  onChange: (value: string) => void
  onClear: () => void
  onSelect: (organization: ServiceOrganization) => void
  organizations: ServiceOrganization[]
  selectedOrganization: ServiceOrganization | null
  value: string
}

export function OrganisationSearchControl({
  isLoading,
  onChange,
  onClear,
  onSelect,
  organizations,
  selectedOrganization,
  value,
}: OrganisationSearchControlProps) {
  const { t } = useI18n()
  const showSuggestions = !selectedOrganization && Boolean(value.trim()) && (organizations.length > 0 || isLoading)

  return (
    <Stack gap={6} style={{ flex: '1 1 280px', minWidth: 220, position: 'relative' }}>
      <TextInput
        label={t('Організація')}
        leftSection={<IconBuilding size={16} />}
        placeholder={t('Введіть назву')}
        rightSection={isLoading ? <Loader color="violet" size="xs" /> : null}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />

      {showSuggestions && (
        <Box
          bg="var(--mantine-color-body)"
          mah={260}
          pos="absolute"
          top="100%"
          left={0}
          right={0}
          mt={4}
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 6,
            boxShadow: 'var(--mantine-shadow-md)',
            overflowY: 'auto',
            zIndex: 20,
          }}
        >
          {organizations.length > 0 ? (
            organizations.map((organization) => (
              <button
                key={`${organization.Name}-${organization.ServiceOrganizationTypes?.join('-')}`}
                type="button"
                onClick={() => onSelect(organization)}
                style={{
                  alignItems: 'center',
                  background: 'transparent',
                  border: 0,
                  borderBottom: '1px solid var(--mantine-color-gray-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Text fw={600} size="sm">
                  {organization.Name}
                </Text>
                <Text c="dimmed" size="xs">
                  {organization.ServiceOrganizationTypes?.length || 0}
                </Text>
              </button>
            ))
          ) : (
            <Text c="dimmed" p="sm" size="sm">
              {t('Пошук організацій')}
            </Text>
          )}
        </Box>
      )}

      {selectedOrganization && (
        <Group gap={6} justify="space-between" wrap="nowrap">
          <Text c="dimmed" size="xs" truncate>
            {t('Обрано')}: {selectedOrganization.Name}
          </Text>
          <Button
            color="gray"
            leftSection={<IconX size={14} />}
            size="compact-xs"
            variant="subtle"
            onClick={onClear}
          >
            {t('Скинути')}
          </Button>
        </Group>
      )}
    </Stack>
  )
}
