import { Button, Loader, Text } from '@mantine/core'

type ProcurementWorkspaceFact = {
  label: string
  value: string
}

type ProcurementWorkspaceStateProps = {
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  description: string
  facts?: ProcurementWorkspaceFact[]
  isLoading?: boolean
  surface?: boolean
  tone?: 'error'
  title: string
}

export function ProcurementWorkspaceState({
  action,
  className,
  description,
  facts = [],
  isLoading = false,
  surface = false,
  tone,
  title,
}: ProcurementWorkspaceStateProps) {
  return (
    <section
      aria-live="polite"
      className={[
        'procure-workspace-state',
        surface ? 'is-surface' : '',
        tone === 'error' ? 'is-error' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {isLoading ? <Loader color="orange" size="sm" /> : null}
      <div className="procure-workspace-state__copy">
        <Text className="app-section-title" component="h2" fw={600} size="sm">
          {title}
        </Text>
        <Text className="procure-workspace-state__description">
          {description}
        </Text>
      </div>

      {facts.length > 0 ? (
        <div className="procure-workspace-state__facts">
          {facts.map((fact) => (
            <div className="procure-workspace-state__fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {action ? (
        <Button className="app-filter-primary-action" color="brand" size="sm" variant="filled" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </section>
  )
}
