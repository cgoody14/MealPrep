export default function Stars({ rating, onRate, size = 'md' }) {
  const labels = ['', 'Meh', 'Fine', 'Good', 'Great', 'Amazing']
  const sizes = { sm: 14, md: 18, lg: 22 }
  const px = sizes[size] || 18

  return (
    <span className="stars" style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={onRate ? (e) => { e.stopPropagation(); onRate(n) } : undefined}
          style={{
            fontSize: px,
            cursor: onRate ? 'pointer' : 'default',
            color: n <= rating ? 'var(--accent2)' : 'var(--border2)',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
          title={onRate ? labels[n] : undefined}
        >
          ★
        </span>
      ))}
      {onRate && rating > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>{labels[rating]}</span>
      )}
    </span>
  )
}
