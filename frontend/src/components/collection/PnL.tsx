import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { collectionApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'

export default function PnL() {
  const { t } = useTranslation()
  const rate = useUsdBrl()
  const { data } = useQuery({ queryKey: ['collection-stats'], queryFn: collectionApi.stats })
  const cost = data?.cost_usd ?? 0
  const value = data?.costed_value_usd ?? 0
  if (cost <= 0) return null  // no cost basis registered yet

  const pnl = value - cost
  const pct = cost ? (pnl / cost) * 100 : 0
  const up = pnl >= 0
  const fmt = (usd: number) => `$${usd.toFixed(2)}${rate ? ` (R$${(usd * rate).toFixed(2).replace('.', ',')})` : ''}`

  return (
    <div className="surface p-4 mb-4">
      <h3 className="text-sm font-semibold text-vault-text mb-3">{t('col.pnlTitle')}</h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlCost')}</p>
          <p className="font-mono text-sm text-vault-text">{fmt(cost)}</p>
        </div>
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlValue')}</p>
          <p className="font-mono text-sm text-green-400">{fmt(value)}</p>
        </div>
        <div>
          <p className="text-[11px] text-vault-muted">{t('col.pnlResult')}</p>
          <p className={`font-mono text-sm flex items-center justify-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? '+' : ''}{fmt(pnl)} ({pct >= 0 ? '+' : ''}{pct.toFixed(0)}%)
          </p>
        </div>
      </div>
    </div>
  )
}
