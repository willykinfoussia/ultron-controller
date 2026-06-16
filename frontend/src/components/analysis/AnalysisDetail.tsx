import type { AnalysisResult } from '../../api/types'
import SignalBadge from './SignalBadge'
import ConfidenceMeter from './ConfidenceMeter'

interface Props {
  result: AnalysisResult
  onClose?: () => void
}

export default function AnalysisDetail({ result, onClose }: Props) {
  return (
    <div className="card analysis-detail" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span className="card-title">{result.method_name}</span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              padding: '1px 7px',
              borderRadius: 'var(--r-full)',
              background: 'var(--primary-sub)',
              color: 'var(--primary)',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {result.category}
          </span>
          <SignalBadge signal={result.signal} />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: 'var(--text-sm)',
            }}
          >
            Close
          </button>
        )}
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Confidence
          </div>
          <ConfidenceMeter value={result.confidence} size="md" />
        </div>

        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Explanation
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text)', lineHeight: 'var(--lh-relaxed)' }}>
            {result.explanation}
          </p>
        </div>

        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Method Information
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Method ID</span>
              <code style={{ fontFamily: 'var(--font-mono)' }}>{result.method_id}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Symbol</span>
              <span style={{ fontWeight: 500 }}>{result.symbol}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Computed At</span>
              <span>{new Date(result.computed_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {Object.keys(result.result).length > 0 && (
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Detailed Results
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 'var(--sp-2)',
            }}>
              {Object.entries(result.result).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    padding: 'var(--sp-2)',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                    {typeof val === 'number' ? val.toFixed(4) : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.chart_data && Object.keys(result.chart_data).length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Chart Data
            </div>
            <pre style={{
              fontSize: 'var(--text-xs)',
              background: 'var(--surface-2)',
              padding: 'var(--sp-3)',
              borderRadius: 'var(--r-md)',
              overflow: 'auto',
              maxHeight: 300,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
            }}>
              {JSON.stringify(result.chart_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
