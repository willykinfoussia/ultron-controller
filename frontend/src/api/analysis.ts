import type { AnalysisMethod, AnalysisResult } from './types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  console.log(`[API] ${init?.method || 'GET'} ${url}`)
  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.text()
      console.error(`[API] ← ${res.status} ${url}: ${body}`)
      throw new Error(`HTTP ${res.status}: ${body}`)
    }
    const data = await res.json()
    console.log(`[API] ← ${res.status} ${url} ✓`)
    return data as T
  } catch (err) {
    console.error(`[API] ✖ ${url}:`, err)
    throw err
  }
}

export async function getAnalysisMethods(): Promise<AnalysisMethod[]> {
  return fetchJSON<AnalysisMethod[]>(`${API_BASE}/analysis/`)
}

export async function getAnalysisCategories(): Promise<{
  category: string
  methods_count: number
  methods: AnalysisMethod[]
}[]> {
  return fetchJSON(`${API_BASE}/analysis/categories`)
}

export async function runAnalysis(
  symbol: string,
  methodId: string,
  params?: Record<string, unknown>
): Promise<AnalysisResult> {
  const qs = params
    ? '?' + new URLSearchParams(params as Record<string, string>).toString()
    : ''
  return fetchJSON<AnalysisResult>(
    `${API_BASE}/analysis/${symbol}/run/${methodId}${qs}`
  )
}

export async function runAllAnalysis(
  symbol: string,
  category: string,
  params?: Record<string, unknown>
): Promise<AnalysisResult[]> {
  return fetchJSON<AnalysisResult[]>(
    `${API_BASE}/analysis/${symbol}/run-all`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, params }),
    }
  )
}

export async function getAnalysisSummary(
  symbol: string
): Promise<AnalysisResult[]> {
  return fetchJSON<AnalysisResult[]>(`${API_BASE}/analysis/${symbol}/summary`)
}
