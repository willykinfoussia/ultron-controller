import { motion } from 'framer-motion'

interface Props {
  value: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function ConfidenceMeter({ value, size = 'md', showLabel = true }: Props) {
  const pct = Math.min(100, Math.max(0, value))
  const h = size === 'sm' ? 4 : size === 'lg' ? 10 : 6

  // Gradient from red (0%) through yellow (50%) to green (100%)
  const color =
    pct >= 70
      ? 'var(--success)'
      : pct >= 40
        ? 'var(--warning)'
        : 'var(--danger)'

  return (
    <div className="confidence-meter" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div
        className="confidence-track"
        style={{
          flex: 1,
          height: h,
          borderRadius: 'var(--r-full)',
          background: 'var(--surface-3)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <motion.div
          className="confidence-fill"
          style={{
            height: '100%',
            borderRadius: 'var(--r-full)',
            background: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
        />
      </div>
      {showLabel && (
        <span
          className="confidence-label"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-2)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
