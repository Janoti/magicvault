import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, TrendingUp, TrendingDown, Sparkles, Crown } from 'lucide-react'
import { collectionApi, cardsApi } from '@/lib/api'
import { useMoney } from '@/components/cards/CardPrice'
import { useAuthStore } from '@/store/auth'
import CardInfoModal from '@/components/cards/CardInfoModal'

export default function InsightsPage() {
  const { t } = useTranslation()
  const fmt = useMoney()
  const user = useAuthStore((s) => s.user)
  const isPremium = !!(user?.is_premium || user?.is_admin)
  const [info, setInfo] = useState<{ id: string; foil: boolean } | null>(null)
  const open = (c: any) => setInfo({ id: c.id, foil: !!c.foil })
  const { data, isLoading } = useQuery({
    queryKey: ['collection-insights'],
    queryFn: collectionApi.insights,
    enabled: isPremium,
  })
  const { data: infoCard } = useQuery({
    queryKey: ['card-by-id', info?.id],
    queryFn: () => cardsApi.getById(info!.id),
    enabled: !!info?.id,
  })

  const topValue: any[] = data?.top_value || []
  const gainers: any[] = data?.gainers || []
  const losers: any[] = data?.losers || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/collection" className="inline-flex items-center gap-1.5 text-sm text-vault-muted hover:text-vault-text mb-4"><ArrowLeft size={15} /> {t('nav.collection')}</Link>
      <h1 className="font-display text-3xl font-bold text-vault-gold mb-1 flex items-center gap-2"><Sparkles size={24} /> {t('col.insightsTitle')}</h1>
      <p className="text-vault-muted text-sm mb-6">{t('col.insightsSubtitle')}</p>

      {!isPremium ? (
        <div className="surface p-10 text-center">
          <Crown size={32} className="text-vault-gold mx-auto mb-3" />
          <p className="text-vault-text mb-4">{t('insightsPage.premiumOnly')}</p>
          <Link to="/premium" className="btn-primary inline-flex items-center gap-2"><Crown size={16} /> {t('insightsPage.goPremium')}</Link>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : topValue.length === 0 ? (
        <div className="surface p-10 text-center text-vault-muted">{t('insightsPage.empty')}</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-vault-text mb-3">{t('insightsPage.topValue')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {topValue.map((c) => (
                <div key={`${c.id}-${c.foil}`} onClick={() => open(c)} className="surface p-3 flex flex-col items-center text-center cursor-pointer hover:border-vault-accent/40 transition-colors">
                  {c.image_small && <img src={c.image_small} alt={c.name} className="w-20 rounded-lg shadow mb-2" />}
                  <p className="text-xs text-vault-text truncate w-full">{c.name}{c.foil ? ' ✦' : ''}</p>
                  <p className="text-[10px] text-vault-muted">{c.set?.toUpperCase()} {c.collector_number ? `#${c.collector_number}` : ''} · ×{c.quantity}</p>
                  <p className="font-mono text-sm text-vault-gold mt-1">{fmt(c.total_usd)}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <MoverList title={t('insightsPage.gainers')} items={gainers} fmt={fmt} up onCardClick={open} />
            <MoverList title={t('insightsPage.losers')} items={losers} fmt={fmt} up={false} emptyKey="insightsPage.noMovers" t={t} onCardClick={open} />
          </div>
        </div>
      )}

      {infoCard && <CardInfoModal card={infoCard} foil={info?.foil} onClose={() => setInfo(null)} />}
    </div>
  )
}

function MoverList({ title, items, fmt, up, emptyKey, t, onCardClick }: { title: string; items: any[]; fmt: (v: number) => string; up: boolean; emptyKey?: string; t?: any; onCardClick: (c: any) => void }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-vault-text mb-3 flex items-center gap-1.5">
        {up ? <TrendingUp size={15} className="text-green-400" /> : <TrendingDown size={15} className="text-red-400" />} {title}
      </h2>
      {items.length === 0 ? (
        <div className="surface p-6 text-center text-vault-muted text-xs">{emptyKey && t ? t(emptyKey) : '—'}</div>
      ) : (
        <div className="surface divide-y divide-vault-border/40">
          {items.map((m) => (
            <div key={`${m.id}-${m.foil}`} onClick={() => onCardClick(m)} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-vault-card/30 transition-colors">
              {m.image_small && <img src={m.image_small} alt={m.name} className="w-7 rounded shadow shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-vault-text truncate">{m.name}{m.foil ? ' ✦' : ''}</p>
                <p className="text-[11px] text-vault-muted">{fmt(m.added_usd)} → {fmt(m.now_usd)}</p>
              </div>
              <span className={`font-mono text-sm shrink-0 ${m.delta_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {m.delta_pct >= 0 ? '+' : ''}{m.delta_pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
