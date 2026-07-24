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
  title: string
}

export function ProcurementWorkspaceState({
  action,
  className,
  description,
  facts = [],
  isLoading = false,
  surface = false,
  title,
}: ProcurementWorkspaceStateProps) {
  return (
    <section
      aria-live="polite"
      className={[
        'procure-workspace-state',
        surface ? 'is-surface' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      role="status"
    >
      {isLoading ? <Loader color="orange" size="sm" /> : null}
      <div className="procure-workspace-state__copy">
        <Text className="app-section-title" fw={600} size="sm">
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
        <Button color="orange" size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </section>
  )
}
