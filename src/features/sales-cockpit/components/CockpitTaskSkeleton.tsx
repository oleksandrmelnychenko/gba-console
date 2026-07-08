export function CockpitTaskSkeleton({ label }: { label: string }) {
  return (
    <div className="cockpit-task-skeleton" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="cockpit-task-skeleton-card">
          <span className="cockpit-task-skeleton-line is-title" />
          <span className="cockpit-task-skeleton-line" />
          <span className="cockpit-task-skeleton-line is-short" />
        </div>
      ))}
    </div>
  )
}
