import type { AnalysisMethod } from '../../api/types'

interface Props {
  method: AnalysisMethod
}

export default function MethodDocs({ method }: Props) {
  const paramEntries = Object.entries(method.parameters || {})

  return (
    <div className="card method-docs" style={{ overflow: 'hidden' }}>
      <div className="card-header">
        <span className="card-title">{method.method_name}</span>
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
          {method.category}
        </span>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Description
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text)', lineHeight: 'var(--lh-relaxed)' }}>
            {method.description || 'No description available.'}
          </p>
        </div>

        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Method ID
          </div>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{method.method_id}</code>
        </div>

        {paramEntries.length > 0 && (
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Parameters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {paramEntries.map(([name, param]) => (
                <div
                  key={name}
                  style={{
                    padding: 'var(--sp-2)',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 2 }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{name}</code>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      padding: '0 5px',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--surface-3)',
                      color: 'var(--text-3)',
                    }}>
                      {param.type}
                    </span>
                    {param.default !== undefined && param.default !== null && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                        default: <code style={{ fontFamily: 'var(--font-mono)' }}>{String(param.default)}</code>
                      </span>
                    )}
                  </div>
                  {param.description && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', margin: 0 }}>
                      {param.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 'var(--sp-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Usage
          </div>
          <pre style={{
            fontSize: 'var(--text-xs)',
            background: 'var(--surface-2)',
            padding: 'var(--sp-2)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)',
            overflow: 'auto',
          }}>
{`GET /api/analysis/{symbol}/run/${method.method_id}`}
          </pre>
        </div>
      </div>
    </div>
  )
}
