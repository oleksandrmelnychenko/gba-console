import {
  ActionIcon,
  Loader,
  Popover,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { Building, X } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ServiceOrganization } from '../types'

type OrganisationSearchControlProps = {
  isLoading: boolean
  onAutoSelect: () => void
  onChange: (value: string) => void
  onClear: () => void
  onSelect: (organization: ServiceOrganization) => void
  organizations: ServiceOrganization[]
  selectedOrganization: ServiceOrganization | null
  value: string
}

const CONTROL_STYLE = {
  flex: '1 1 280px',
  minWidth: 220,
  position: 'relative',
} as const

const SUGGESTIONS_PANEL_STYLE = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 6,
  boxShadow: 'var(--mantine-shadow-md)',
  overflowY: 'auto',
  zIndex: 20,
} as const

const SUGGESTION_BUTTON_STYLE = {
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
} as const

export function OrganisationSearchControl({
  isLoading,
  onAutoSelect,
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
    <Stack
      className="organisation-search-control"
      gap={0}
      style={CONTROL_STYLE}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget

        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return
        }

        onAutoSelect()
      }}
    >
      <Popover opened={showSuggestions} position="bottom-start" shadow="md" width="target" withinPortal>
        <Popover.Target>
          <TextInput
            label={t('Організація')}
            leftSection={<Building size={16} />}
            placeholder={t('Введіть назву')}
            rightSection={
              isLoading ? (
                <Loader color="orange" size="xs" />
              ) : selectedOrganization ? (
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size="sm"
                  type="button"
                  variant="subtle"
                  onClick={onClear}
                >
                  <X size={14} />
                </ActionIcon>
              ) : null
            }
            rightSectionPointerEvents={selectedOrganization ? 'all' : 'none'}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </Popover.Target>

        <Popover.Dropdown mah={260} p={0} style={SUGGESTIONS_PANEL_STYLE}>
          {organizations.length > 0 ? (
            organizations.map((organization) => (
              <button
                key={`${organization.Name}-${organization.ServiceOrganizationTypes?.join('-')}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(organization)}
                style={SUGGESTION_BUTTON_STYLE}
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
        </Popover.Dropdown>
      </Popover>

    </Stack>
  )
}
