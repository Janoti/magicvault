import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, X, Check } from 'lucide-react'
import { cardsApi, collectionApi, bindersApi, decksApi } from '@/lib/api'
import CardTile from '@/components/cards/CardTile'

type Tab = 'collection' | 'binders' | 'search'

/** Add-cards modal for a deck: pull from the user's collection, a binder, or a
 *  live Scryfall search. The text box filters/searches dynamically (debounced). */
export default function AddCardsModal({ deckId, format, onClose }: { deckId: number; format?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('collection')
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')           // debounced query
  const [binderId, setBinderId] = useState<number | null>(null)
  const [added, setAdded] = useState<Record<string, number>>({})

  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(id) }, [q])

  const addMut = useMutation({
    mutationFn: (data: any) => decksApi.addCard(deckId, data),
    onSuccess: (_d, data: any) => {
      qc.invalidateQueries({ queryKey: ['deck', deckId] })
      setAdded((a) => ({ ...a, [data.scryfall_id]: (a[data.scryfall_id] || 0) + 1 }))
    },
  })

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['deck-add-search', dq],
    queryFn: () => cardsApi.search(dq),
    enabled: tab === 'search' && dq.length >= 2,
  })
  const { data: colData, isFetching: colLoading } = useQuery({
    queryKey: ['deck-add-collection', dq],
    queryFn: () => collectionApi.list({ q: dq || undefined, with_cards: true, per_page: 60 }),
    enabled: tab === 'collection',
  })
  const { data: binders = [] } = useQuery({ queryKey: ['binders'], queryFn: bindersApi.list, enabled: tab === 'binders' })
  const { data: binderData } = useQuery({
    queryKey: ['binder', binderId],
    queryFn: () => bindersApi.get(binderId as number),
    enabled: tab === 'binders' && !!binderId,
  })

  let cards: any[] = []
  if (tab === 'search') cards = (searchData?.cards || []).map((c: any) => ({ card: c }))
  else if (tab === 'collection') cards = (colData?.items || []).filter((i: any) => i.card)
  else if (tab === 'binders' && binderData) {
    const needle = dq.toLowerCase()
    cards = (binderData.cards || []).filter((i: any) => i.card && (!needle || (i.card.name || '').toLowerCase().includes(needle)))
  }

  const loading = (tab === 'search' && searching) || (tab === 'collection' && colLoading)
  const emptyMsg = tab === 'search'
    ? (dq.length < 2 ? t('addCards.typeToSearch') : t('addCards.noResults'))
    : tab === 'collection' ? t('addCards.noCollection')
    : !binderId ? t('addCards.pickBinder') : t('addCards.binderEmpty')

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === id ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-vault-gold">{t('detail.addToDeck')}</h2>
          <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
        </div>

        <div className="flex gap-1 mb-3">
          <TabBtn id="collection" label={t('addCards.tabCollection')} />
          <TabBtn id="binders" label={t('addCards.tabBinders')} />
          <TabBtn id="search" label={t('addCards.tabSearch')} />
        </div>

        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
          <input autoFocus className="input-field w-full pl-9"
            placeholder={tab === 'search' ? t('addCards.searchPlaceholder') : t('addCards.filterPlaceholder')}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {tab === 'binders' && (
          <select className="input-field mb-3 text-sm" value={binderId ?? ''} onChange={(e) => setBinderId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('addCards.pickBinder')}</option>
            {(binders as any[]).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : cards.length === 0 ? (
            <p className="text-center text-sm text-vault-muted py-8">{emptyMsg}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cards.map((it: any, idx: number) => {
                const id = it.card.id
                return (
                  <div key={`${id}-${idx}`} className="relative">
                    <CardTile card={it.card} showActions={false} />
                    <div className="flex gap-1 mt-1 items-center">
                      <button onClick={() => addMut.mutate({ scryfall_id: id, quantity: 1 })} className="flex-1 text-[10px] btn-primary py-1">+ Main</button>
                      <button onClick={() => addMut.mutate({ scryfall_id: id, quantity: 1, is_sideboard: true })} className="flex-1 text-[10px] btn-ghost py-1 border border-vault-border">Side</button>
                      {format === 'commander' && (
                        <button onClick={() => addMut.mutate({ scryfall_id: id, quantity: 1, is_commander: true })} className="text-[10px] px-2 btn-ghost py-1 border border-vault-gold/30 text-vault-gold">CMD</button>
                      )}
                      {added[id] ? <span className="text-[10px] text-green-400 flex items-center gap-0.5 pl-0.5"><Check size={11} />{added[id]}</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
