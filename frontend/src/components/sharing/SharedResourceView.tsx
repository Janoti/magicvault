import CardTile from '@/components/cards/CardTile'
import { useTranslation } from 'react-i18next'

export default function SharedResourceView({ data }: { data: any }) {
  const { t } = useTranslation()
  const TYPE_LABEL: Record<string, string> = {
    collection: t('nav.collection'),
    binder: 'Binder',
    deck: 'Deck',
  }
  if (!data) return null
  const cards: any[] = data.cards || []
  const totalValue = cards.reduce((sum, c) => {
    const unit = (c.foil ? c.card?.price_usd_foil : c.card?.price_usd) || 0
    return sum + unit * (c.quantity || 1)
  }, 0)

  return (
    <div>
      <div className="mb-6">
        <span className="text-[10px] uppercase tracking-wider text-vault-muted bg-vault-card px-2 py-0.5 rounded-full">
          {TYPE_LABEL[data.resource_type] || data.resource_type}
          {data.format ? ` • ${data.format}` : ''}
        </span>
        <h1 className="font-display text-3xl font-bold text-vault-gold mt-2">{data.title}</h1>
        <p className="text-vault-muted text-sm mt-0.5">
          {t('shared.by', { name: data.owner })} • {t('common.cardsCount', { count: cards.length })}
          {totalValue > 0 && <> • <span className="text-green-400 font-mono">${totalValue.toFixed(2)}</span></>}
        </p>
        {data.description && <p className="text-sm text-vault-muted mt-2 max-w-2xl">{data.description}</p>}
      </div>

      {cards.length === 0 ? (
        <p className="text-vault-muted text-center py-20">{t('pages.empty')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {cards.map((c, i) => (
            <div key={i} className="relative">
              <CardTile card={c.card} showActions={false} />
              <div className="absolute top-1 left-1 flex gap-1">
                {c.quantity > 1 && (
                  <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">×{c.quantity}</span>
                )}
                {c.condition && (
                  <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                    {c.condition}{c.foil ? ' ⚡' : ''}
                  </span>
                )}
                {c.is_commander && (
                  <span className="text-[10px] bg-vault-gold/80 text-black px-1.5 py-0.5 rounded font-mono">CMD</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
