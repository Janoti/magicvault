import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { collectionApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'

export default function PnLPage() {
  const { t } = useTranslation()
  const rate = useUsdBrl()
  const { data, isLoading } = useQuery({ queryKey: ['pnl'], queryFn: collectionApi.pnl })

  const items: any[] = data?.items || []
  const cost = data?.cost_usd ?? 0
  const value = data?.costed_value_usd ?? 0
  const pnl = value - cost
  const pct = cost ? (pnl / cost) * 100 : 0
  const up = pnl >= 0
  const noMarketCount = items.filter((i) => !i.has_market).length
  const fmt = (usd: number) => `$${usd.toFixed(2)}${rate ? ` (R$${(usd * rate).toFixed(2).replace('.', ',')})` : ''}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/collection" className="inline-flex items-center gap-1.5 text-sm text-vault-muted hover:text-vault-text mb-4"><ArrowLeft size={15} /> {t('nav.collection')}</Link>
      <h1 className="font-display text-3xl font-bold text-vault-gold mb-1">{t('col.pnlTitle')}</h1>
      <p className="text-vault-muted text-sm mb-6">{t('col.pnlSubtitle')}</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="surface p-10 text-center text-vault-muted">{t('pnlPage.empty')}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="surface p-4 text-center">
              <p className="text-[11px] text-vault-muted">{t('col.pnlCost')}</p>
              <p className="font-mono text-sm text-vault-text">{fmt(cost)}</p>
            </div>
            <div className="surface p-4 text-center">
              <p className="text-[11px] text-vault-muted">{t('col.pnlValue')}</p>
              <p className="font-mono text-sm text-green-400">{fmt(value)}</p>
            </div>
            <div className="surface p-4 text-center">
              <p className="text-[11px] text-vault-muted">{t('col.pnlResult')}</p>
              <p className={`font-mono text-sm flex items-center justify-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? '+' : ''}{fmt(pnl)} ({pct >= 0 ? '+' : ''}{pct.toFixed(0)}%)
              </p>
            </div>
          </div>

          {noMarketCount > 0 && (
            <p className="text-[12px] text-amber-400/90 mb-3 flex items-center gap-1.5">
              <AlertCircle size={14} /> {t('pnlPage.noMarketNote', { count: noMarketCount })}
            </p>
          )}

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vault-border text-xs text-vault-muted">
                  <th className="text-left px-3 py-2.5">{t('pnlPage.thCard')}</th>
                  <th className="text-right px-3 py-2.5">{t('pnlPage.thPaid')}</th>
                  <th className="text-right px-3 py-2.5">{t('pnlPage.thNow')}</th>
                  <th className="text-right px-3 py-2.5">{t('pnlPage.thResult')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const d = i.current_usd - i.cost_usd
                  const p = i.cost_usd ? (d / i.cost_usd) * 100 : 0
                  const u = d >= 0
                  return (
                    <tr key={`${i.id}-${i.foil}`} className="border-b border-vault-border/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          {i.image_small && <img src={i.image_small} alt={i.name} className="w-7 rounded shadow shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-vault-text truncate">{i.name}{i.foil ? ' ✦' : ''}</p>
                            <p className="text-[11px] text-vault-muted">{i.set?.toUpperCase()} {i.collector_number ? `#${i.collector_number}` : ''} · ×{i.quantity}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-vault-text">{fmt(i.cost_usd)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {i.has_market ? <span className="text-green-400">{fmt(i.current_usd)}</span> : <span className="text-vault-muted">{t('pnlPage.noPrice')}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {i.has_market ? (
                          <span className={u ? 'text-green-400' : 'text-red-400'}>{u ? '+' : ''}{d.toFixed(2)} ({p >= 0 ? '+' : ''}{p.toFixed(0)}%)</span>
                        ) : <span className="text-vault-muted">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
