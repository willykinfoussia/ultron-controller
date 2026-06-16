import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAnalysisMethods,
  getAnalysisCategories,
  getAnalysisSummary,
} from '../api/analysis'
import type { AnalysisMethod, AnalysisResult } from '../api/types'
import type { Signal } from '../components/analysis/SignalBadge'
import AnalysisCard from '../components/analysis/AnalysisCard'
import AnalysisDetail from '../components/analysis/AnalysisDetail'
import MethodDocs from '../components/analysis/MethodDocs'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'

const STAGGER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
}

const CATEGORY_ORDER = ['all', 'technical', 'fundamental', 'sentiment', 'ml']

interface Props {
  symbol?: string
}

export default function Analysis({ symbol = 'AAPL' }: Props) {
  const [methods, setMethods] = useState<AnalysisMethod[]>([])
  const [categories, setCategories] = useState<string[]>(['all'])
  const [activeCategory, setActiveCategory] = useState('all')
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMethods = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meths, cats] = await Promise.all([
        getAnalysisMethods(),
        getAnalysisCategories(),
      ])
      setMethods(meths)
      const catNames = ['all', ...cats.map((c) => c.category.toLowerCase())]
      const ordered = CATEGORY_ORDER.filter((c) => catNames.includes(c))
      const rest = catNames.filter((c) => !CATEGORY_ORDER.includes(c))
      setCategories([...ordered, ...rest])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMethods()
  }, [fetchMethods])

  const filteredMethods =
    activeCategory === 'all'
      ? methods
      : methods.filter(
          (m) => m.category.toLowerCase() === activeCategory.toLowerCase()
        )

  async function handleRunAnalysis() {
    if (!symbol) return
    setRunning(true)
    setError(null)
    setResults([])
    try {
      const summary = await getAnalysisSummary(symbol)
      setResults(summary)
    } catch (err) {
      setError(String(err))
    } finally {
      setRunning(false)
    }
  }

  function getSignalCounts(results: AnalysisResult[]) {
    const counts: Record<Signal, number> = { buy: 0, sell: 0, hold: 0, neutral: 0 }
    results.forEach((r) => {
      const s = r.signal.toLowerCase() as Signal
      if (s in counts) counts[s]++
    })
    return counts
  }

  const signalCounts = getSignalCounts(results)
  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0

  return (
    <div className="page page-stagger">
      <motion.div {...STAGGER}>
        <PageHeader
          title="Analysis"
          meta={symbol + ' - ' + methods.length + ' methods available'}
        />
      </motion.div>
      {error && (
        <motion.div {...STAGGER} className="card" style={{ borderColor: 'var(--danger-border)' }}>
          <div className="card-body text-danger">Error: {error}</div>
        </motion.div>
      )}
      {loading && (
        <div className="card">
          <div className="card-body">
            <div className="loading-center" style={{ padding: 'var(--sp-6)' }}>
              <Spinner size="lg" />
              <p style={{ color: 'var(--text-2)', marginTop: 'var(--sp-3)' }}>Loading analysis methods...</p>
            </div>
          </div>
        </div>
      )}
      {!loading && !error && (
        <>
          <motion.div {...STAGGER} transition={{ ...STAGGER.transition, delay: 0.05 }}>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
              {categories.map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                  className={'chip ' + (activeCategory === cat ? 'active' : '')}
                  style={{ textTransform: 'capitalize', fontWeight: activeCategory === cat ? 600 : 400 }}>
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
          <motion.div {...STAGGER} transition={{ ...STAGGER.transition, delay: 0.07 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <button type="button" onClick={handleRunAnalysis} disabled={running || !symbol}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
                  padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--primary)', background: 'var(--primary)',
                  color: 'var(--primary-fg)', fontWeight: 600, fontSize: 'var(--text-sm)',
                  cursor: running ? 'wait' : 'pointer', opacity: running ? 0.7 : 1,
                  transition: 'all var(--t-fast) var(--ease-out)' }}>
                {running ? (<><Spinner size="sm" /> Running...</>) : (<>Run All Analysis</>)}
              </button>
            </div>
          </motion.div>
          {results.length > 0 && (
            <motion.div {...STAGGER} transition={{ ...STAGGER.transition, delay: 0.1 }}>
              <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="card-header">
                  <span className="card-title">Summary - {symbol}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{results.length} results</span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                    <div style={{ textAlign: 'center', padding: 'var(--sp-2)', background: 'var(--success-sub)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--success)' }}>{signalCounts.buy}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600 }}>Buy</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 'var(--sp-2)', background: 'var(--danger-sub)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--danger)' }}>{signalCounts.sell}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600 }}>Sell</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 'var(--sp-2)', background: 'var(--warning-sub)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--warning)' }}>{signalCounts.hold}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600 }}>Hold</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 'var(--sp-2)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-3)' }}>{signalCounts.neutral}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600 }}>Neutral</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Avg. Confidence:</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 'var(--r-full)', background: 'var(--surface-3)', overflow: 'hidden' }}>
                      <motion.div style={{ height: '100%', borderRadius: 'var(--r-full)',
                        background: avgConfidence >= 60 ? 'var(--success)' : avgConfidence >= 40 ? 'var(--warning)' : 'var(--danger)' }}
                        initial={{ width: 0 }} animate={{ width: avgConfidence + '%' }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }} />
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round(avgConfidence)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            <motion.div key={activeCategory} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                {filteredMethods.map((method) => {
                  const methodResult = results.find((r) => r.method_id === method.method_id)
                  return (
                    <motion.div key={method.method_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <div className="card" style={{ cursor: 'pointer', overflow: 'hidden' }}
                        onClick={() => setSelectedMethod(selectedMethod?.method_id === method.method_id ? null : method)}>
                        <div className="card-body" style={{ padding: 'var(--sp-3)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                            <span style={{ fontWeight: 600 }}>{method.method_name}</span>
                            <span style={{ fontSize: 'var(--text-xs)', padding: '1px 7px', borderRadius: 'var(--r-full)', background: 'var(--primary-sub)', color: 'var(--primary)', fontWeight: 500, textTransform: 'capitalize' }}>{method.category}</span>
                          </div>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 'var(--lh-relaxed)' }}>{method.description || 'No description available.'}</p>
                          {methodResult && (
                            <div style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-2)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-xs)' }}>
                              <span style={{ fontWeight: 600, color: methodResult.signal === 'buy' ? 'var(--success)' : methodResult.signal === 'sell' ? 'var(--danger)' : methodResult.signal === 'hold' ? 'var(--warning)' : 'var(--text-3)', textTransform: 'uppercase' }}>{methodResult.signal}</span>
                              <span style={{ color: 'var(--text-3)' }}> - {Math.round(methodResult.confidence)}% confidence</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedMethod?.method_id === method.method_id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: 'var(--sp-2)' }}>
                          <MethodDocs method={method} />
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
          {results.length > 0 && (
            <motion.div {...STAGGER}>
              <h3 style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Results</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-3)' }}>
                {results.map((result) => (
                  <div key={result.method_id} onClick={() => setSelectedResult(selectedResult?.method_id === result.method_id ? null : result)} style={{ cursor: 'pointer' }}>
                    <AnalysisCard result={result} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          <AnimatePresence>
            {selectedResult && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
                style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 'var(--sp-4)' }}
                onClick={() => setSelectedResult(null)}>
                <div style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                  <AnalysisDetail result={selectedResult} onClose={() => setSelectedResult(null)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!running && results.length === 0 && !loading && (
            <motion.div {...STAGGER} transition={{ ...STAGGER.transition, delay: 0.1 }}>
              <div className="empty-state" style={{ padding: 'var(--sp-10)' }}>
                <span className="empty-state-icon">A</span>
                <span className="empty-state-title">No analysis results yet</span>
                <span className="empty-state-desc">Click "Run All Analysis" to analyze {symbol} using all available methods.</span>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
