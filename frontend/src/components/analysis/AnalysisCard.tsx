import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnalysisResult } from '../../api/types'
import SignalBadge from './SignalBadge'
import ConfidenceMeter from './ConfidenceMeter'

interface Props {
  result: AnalysisResult
}

export default function AnalysisCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      className="card analysis-card"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
      style={{ overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="card-body" style={{ padding: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{result.method_name}</span>
          <span
            className="chip-category"
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
          <SignalBadge signal={result.signal} size="sm" />
        </div>

        <ConfidenceMeter value={result.confidence} size="sm" />

        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-2)',
          marginTop: 'var(--sp-2)',
          lineHeight: 'var(--lh-relaxed)',
        }}>
          {result.explanation}
        </p>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 'var(--sp-3)',
                paddingTop: 'var(--sp-3)',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)' }}>
                  Method ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{result.method_id}</code>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                  Computed: {new Date(result.computed_at).toLocaleString()}
                </div>

                {result.chart_data && Object.keys(result.chart_data).length > 0 && (
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 'var(--sp-2)' }}>
                      Chart Data
                    </div>
                    <pre style={{
                      fontSize: 'var(--text-xs)',
                      background: 'var(--surface-2)',
                      padding: 'var(--sp-2)',
                      borderRadius: 'var(--r-md)',
                      overflow: 'auto',
                      maxHeight: 200,
                      color: 'var(--text-2)',
                    }}>
                      {JSON.stringify(result.chart_data, null, 2)}
                    </pre>
                  </div>
                )}

                {Object.keys(result.result).length > 0 && (
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 'var(--sp-2)' }}>
                      Detailed Results
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(result.result).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--text-3)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {typeof val === 'number' ? val.toFixed(4) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          marginTop: 'var(--sp-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-3)',
          textAlign: 'right',
        }}>
          {expanded ? '▲ Collapse' : '▼ Expand for details'}
        </div>
      </div>
    </motion.div>
  )
}
