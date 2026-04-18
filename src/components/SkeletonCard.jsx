export default function SkeletonCard({ delay = 0 }) {
  return (
    <div className="meal-card skeleton-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="meal-card-body">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-stars" />
        <div className="skeleton-line skeleton-meta" />
        <div className="skeleton-chips">
          <div className="skeleton-chip" />
          <div className="skeleton-chip" />
          <div className="skeleton-chip" />
        </div>
      </div>
      <div className="meal-card-footer">
        <div className="skeleton-line skeleton-btn" />
      </div>
    </div>
  )
}
