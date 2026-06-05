import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { collectionApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'

export default function ValueChart() {
  const { t, i18n } = useTranslation()
  const rate = useUsdBrl()
  const { data: history = [] } = useQuery({ queryKey: ['value-history'], queryFn: collectionApi.valueHistory })

  if (history.length < 2) return null  // builds up over days of use

  const values = history.map((h: any) => h.value)
  const n = values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const line = history.map((h: any, i: number) => `${((i / (n - 1)) * 100).toFixed(2)},${(38 - ((h.value - min) / span) * 34).toFixed(2)}`).join(' ')
  const first = values[0]
  const last = values[n - 1]
  const deltaPct = first ? ((last - first) / first) * 100 : 0
  const up = last >= first

  // 7-day variation: compare to the last snapshot from ~7+ days ago.
  const weekAgo = Date.now() - 7 * 864e5
  let weekRef = values[0]
  for (let i = history.length - 1; i >= 0; i--) {
    if (new Date(history[i].date + 'T00:00:00').getTime() <= weekAgo) { weekRef = history[i].value; break }
  }
  const weekPct = weekRef ? ((last - weekRef) / weekRef) * 100 : 0
  const weekUp = weekPct >= 0
  const brl = (v: number) => (rate ? ` ≈ R$${(v * rate).toFixed(2).replace('.', ',')}` : '')
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })

  return (
    <div className="surface p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-vault-text">{t('col.valueOverTime')}</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1 ${weekUp ? 'text-green-400' : 'text-red-400'}`} title={t('col.last7d')}>
            {t('col.last7d')}: {weekPct >= 0 ? '+' : ''}{weekPct.toFixed(1)}%
          </span>
          <span className={`flex items-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-24">
        <defs>
          <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,40 ${line} 100,40`} fill="url(#vg)" />
        <polyline points={line} fill="none" stroke="#6c5ce7" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11px] text-vault-muted mt-1">
        <span>{fmtDate(history[0].date)}</span>
        <span className="font-mono text-green-400">${last.toFixed(2)}{brl(last)}</span>
        <span>{fmtDate(history[n - 1].date)}</span>
      </div>
    </div>
  )
}
