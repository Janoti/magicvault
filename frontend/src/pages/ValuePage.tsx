import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { collectionApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'

export default function ValuePage() {
  const { t, i18n } = useTranslation()
  const rate = useUsdBrl()
  const { data: history = [], isLoading } = useQuery({ queryKey: ['value-history'], queryFn: collectionApi.valueHistory })

  const brl = (v: number) => (rate ? `R$${(v * rate).toFixed(2).replace('.', ',')}` : '')
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })

  const chart = useMemo(() => {
    if (history.length < 2) return null
    const W = 1000, H = 320, pad = 8
    const values = history.map((h: any) => h.value)
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
    const x = (i: number) => pad + (i / (history.length - 1)) * (W - pad * 2)
    const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2)
    const line = history.map((h: any, i: number) => `${x(i).toFixed(1)},${y(h.value).toFixed(1)}`).join(' ')
    const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`
    return { W, H, line, area, min, max, y }
  }, [history])

  const last = history.length ? history[history.length - 1].value : 0
  const change = (days: number) => {
    if (history.length < 2) return null
    const ref = Date.now() - days * 864e5
    let base = history[0].value
    for (let i = history.length - 1; i >= 0; i--) {
      if (new Date(history[i].date + 'T00:00:00').getTime() <= ref) { base = history[i].value; break }
    }
    return base ? ((last - base) / base) * 100 : 0
  }
  const d7 = change(7), d30 = change(30)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/collection" className="inline-flex items-center gap-1.5 text-sm text-vault-muted hover:text-vault-text mb-4"><ArrowLeft size={15} /> {t('nav.collection')}</Link>
      <h1 className="font-display text-3xl font-bold text-vault-gold mb-1">{t('col.valueOverTime')}</h1>
      <p className="text-vault-muted text-sm mb-6">{t('valuePage.subtitle')}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label={t('valuePage.current')} value={`$${last.toFixed(2)}`} sub={brl(last)} />
        <Delta label={t('valuePage.d7')} pct={d7} />
        <Delta label={t('valuePage.d30')} pct={d30} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : !chart ? (
        <div className="surface p-10 text-center text-vault-muted">{t('valuePage.needMore')}</div>
      ) : (
        <div className="surface p-4">
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full h-auto" preserveAspectRatio="none">
            <defs>
              <linearGradient id="vfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={chart.area} fill="url(#vfill)" />
            <polyline points={chart.line} fill="none" stroke="#8b7bf0" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex justify-between text-xs text-vault-muted mt-2">
            <span>{fmtDate(history[0].date)}</span>
            <span className="text-vault-text">{t('valuePage.points', { count: history.length })}</span>
            <span>{fmtDate(history[history.length - 1].date)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-4 text-center">
      <p className="text-[11px] text-vault-muted">{label}</p>
      <p className="font-mono font-bold text-vault-gold text-lg">{value}</p>
      {sub && <p className="text-[11px] text-vault-muted">{sub}</p>}
    </div>
  )
}
function Delta({ label, pct }: { label: string; pct: number | null }) {
  const up = (pct ?? 0) >= 0
  return (
    <div className="surface p-4 text-center">
      <p className="text-[11px] text-vault-muted">{label}</p>
      {pct == null ? <p className="font-mono text-lg text-vault-muted">—</p> : (
        <p className={`font-mono font-bold text-lg flex items-center justify-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{up ? '+' : ''}{pct.toFixed(1)}%
        </p>
      )}
    </div>
  )
}
