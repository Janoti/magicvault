import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Check } from 'lucide-react'
import { decksApi } from '@/lib/api'
import CardPrice from '@/components/cards/CardPrice'

export default function DeckSuggestions({ deckId }: { deckId: number }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['deck-suggestions', deckId], queryFn: () => decksApi.suggestions(deckId) })

  const addMutation = useMutation({
    mutationFn: (scryfallId: string) => decksApi.addCard(deckId, { scryfall_id: scryfallId, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', deckId] }),
  })

  if (isLoading) {
    return <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!data?.commander) {
    return <p className="text-sm text-vault-muted text-center py-6">{t('suggest.commanderOnly')}</p>
  }
  if (!data.suggestions?.length) {
    return <p className="text-sm text-vault-muted text-center py-6">{t('suggest.none')}</p>
  }

  return (
    <div>
      <p className="text-xs text-vault-muted mb-3">{t('suggest.basedOn', { name: data.commander })}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {data.suggestions.map((s: any) => (
          <div key={s.card.id} className="relative group">
            {s.card.image_small
              ? <img src={s.card.image_small} alt={s.card.name} className="w-full rounded-lg shadow" loading="lazy" />
              : <div className="aspect-[63/88] rounded-lg bg-vault-card flex items-center justify-center p-1 text-[10px] text-center">{s.card.name}</div>}
            {s.owned && (
              <span className="absolute top-1 left-1 text-[9px] bg-green-500/90 text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <Check size={9} /> {t('suggest.owned')}
              </span>
            )}
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
              <span className="text-[10px] bg-black/70 rounded px-1 py-0.5"><CardPrice usd={s.card.price_usd} purchaseUri={s.card.purchase_uri} compact /></span>
              <button onClick={() => addMutation.mutate(s.card.id)} title={t('suggest.add')}
                className="bg-vault-accent text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-vault-muted/70 mt-3">{t('suggest.disclaimer')}</p>
    </div>
  )
}
