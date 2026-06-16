export type Signal = 'buy' | 'sell' | 'hold' | 'neutral'

const SIGNAL_STYLES: Record<Signal, { bg: string; border: string; text: string; label: string }> = {
  buy:     { bg: 'var(--success-sub)',   border: 'var(--success-border)',   text: 'var(--success)',   label: 'BUY' },
  sell:    { bg: 'var(--danger-sub)',    border: 'var(--danger-border)',    text: 'var(--danger)',    label: 'SELL' },
  hold:    { bg: 'var(--warning-sub)',   border: 'var(--warning-border)',   text: 'var(--warning)',   label: 'HOLD' },
  neutral: { bg: 'rgba(120,120,160,0.10)', border: 'rgba(120,120,160,0.25)', text: 'var(--text-3)', label: 'NEUTRAL' },
}

interface Props {
  signal: Signal
  size?: 'sm' | 'md'
}

export default function SignalBadge({ signal, size = 'md' }: Props) {
  const s = SIGNAL_STYLES[signal] || SIGNAL_STYLES.neutral
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fs = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)'

  return (
    <span
      className="signal-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: pad,
        borderRadius: 'var(--r-full)',
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {s.label}
    </span>
  )
}
