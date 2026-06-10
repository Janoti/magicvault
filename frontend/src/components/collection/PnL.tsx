import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { collectionApi } from '@/lib/api'
import { useMoney } from '@/components/cards/CardPrice'

export default function PnL() {
  const { t } = useTranslation()
  const fmt = useMoney()
  const { data } = useQuery({ queryKey: ['collection-stats'], queryFn: collectionApi.stats })
  const cost = data?.cost_usd ?? 0
  const value = data?.costed_value_usd ?? 0
  if (cost <= 0) return null  // no cost basis registered yet

  const pnl = value - cost
  const pct = cost ? (pnl / cost) * 100 : 0
  const up = pnl >= 0

  const noMarket = value <= 0  // we don't have a current price for the costed cards

  return (
    <Link to="/collection/pnl" className="block surface p-4 mb-4 hover:border-vault-accent/40 transition-all group">
      <h3 className="text-sm font-semibold text-vault-text flex items-center gap-1">{t('col.pnlTitle')} <ChevronRight size={14} className="text-vault-muted group-hover:text-vault-accent transition-colors" /></h3>
      <p className="text-[11px] text-vault-muted mb-3">{t('col.pnlSubtitle')}</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlCost')}</p>
          <p className="font-mono text-sm text-vault-text">{fmt(cost)}</p>
          <p className="text-[10px] text-vault-muted/70">{t('col.pnlCostSub')}</p>
        </div>
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlValue')}</p>
          <p className="font-mono text-sm text-green-400">{noMarket ? '—' : fmt(value)}</p>
          <p className="text-[10px] text-vault-muted/70">{t('col.pnlValueSub')}</p>
        </div>
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlResult')}</p>
          {noMarket ? (
            <p className="font-mono text-sm text-vault-muted">—</p>
          ) : (
            <p className={`font-mono text-sm flex items-center justify-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
              {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? '+' : ''}{fmt(pnl)} ({pct >= 0 ? '+' : ''}{pct.toFixed(0)}%)
            </p>
          )}
          <p className="text-[10px] text-vault-muted/70">{t('col.pnlResultSub')}</p>
        </div>
      </div>
      {noMarket && <p className="text-[11px] text-amber-400/80 mt-3">{t('col.pnlNoMarket')}</p>}
    </Link>
  )
}
